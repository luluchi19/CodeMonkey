"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createWebhook, ensureRepositoryWebhook, getRepositories } from "@/module/github/lib/github";
import { inngest } from "@/inngest/client";
import { canConnectRepository, decrementRepositoryCount, incrementRepositoryCount } from "@/module/payment/lib/subscription";
import { syncSubscriptionStatus } from "@/module/payment/action";

export const fetchRepositories = async (
  page: number = 1,
  perPage: number = 10
) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const githubRepos = await getRepositories(page, perPage);

  const dbRepos = await prisma.repository.findMany({
    where: {
        userId: session.user.id,
    },
  });

  const connectedRepos = dbRepos.filter((repo) => !repo.disconnectedAt);
  if (connectedRepos.length > 0) {
    const syncResults = await Promise.allSettled(
      connectedRepos.map((repo) => ensureRepositoryWebhook(repo.owner, repo.name))
    );
    syncResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const failed = connectedRepos[index];
        console.warn(
          `Webhook auto-sync failed for ${failed.owner}/${failed.name}`,
          result.reason
        );
      }
    });
  }

  const connectedRepoMap = new Map(
    dbRepos.map((repo) => [repo.githubId.toString(), repo])
  );

  return githubRepos.map((repo: any) => {
    const connectedRepo = connectedRepoMap.get(repo.id.toString());
    const isConnected = Boolean(connectedRepo && !connectedRepo.disconnectedAt);

    return {
      ...repo,
      isConnected,
      indexStatus: isConnected ? (connectedRepo?.indexStatus || "ready") : "disconnected",
      indexMessage: isConnected ? (connectedRepo?.indexMessage || null) : "Disconnected",
      indexedAt: isConnected ? (connectedRepo?.indexedAt || null) : null,
    };
  });

};

export const connectRepository = async (owner: string, repo: string, githubId: number) => {

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    throw new Error("Unauthorized")
  }

  // TODO: CHECK IF USER CAN CONNECT MORE REPO
  let canConnect = await canConnectRepository(session.user.id);

  if (!canConnect) {
    try {
      await syncSubscriptionStatus();
      canConnect = await canConnectRepository(session.user.id);
    } catch (error) {
      console.error("Failed to sync subscription status:", error);
    }
  }

  if(!canConnect){
    throw new Error("Repository connection limit reached. Please upgrade your subscription to PRO to connect more repositories.");
  }

  const existingRepo = await prisma.repository.findFirst({
    where: {
      githubId: BigInt(githubId),
      userId: session.user.id,
    },
  });

  if (existingRepo && !existingRepo.disconnectedAt) {
    return { ok: true, alreadyConnected: true };
  }

  const webhook = await createWebhook(owner, repo);

  if (!webhook) {
    throw new Error("Failed to create GitHub webhook. Please check repository permissions and try again.");
  }

  const repositoryRecord = existingRepo
    ? await prisma.repository.update({
        where: { id: existingRepo.id },
        data: {
          disconnectedAt: null,
          indexStatus: "indexing",
          indexMessage: "Indexing queued",
        },
      })
    : await prisma.repository.create({
        data: {
          githubId: BigInt(githubId),
          name: repo,
          owner,
          fullName: `${owner}/${repo}`,
          url: `https://github.com/${owner}/${repo}`,
          userId: session.user.id,
          indexStatus: "indexing",
          indexMessage: "Indexing queued",
        },
      });

  await incrementRepositoryCount(session.user.id);

  try {
    await inngest.send({
      name: "repository.connected",
      data: {
        owner,
        repo,
        userId: session.user.id,
      },
    });
  } catch (error) {
    console.error("Failed to trigger repository indexing:", error);

    await prisma.repository.update({
      where: { id: repositoryRecord.id },
      data: {
        disconnectedAt: new Date(),
        indexStatus: "ready",
        indexMessage: "Disconnected: failed to queue indexing. Please reconnect and try again.",
      },
    });
    await decrementRepositoryCount(session.user.id, 1);

    throw new Error("Failed to start indexing. Repository has been reset to disconnected state.");
  }

  return { ok: true, queued: true };
}
