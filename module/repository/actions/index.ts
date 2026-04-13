"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createWebhook, getRepositories } from "@/module/github/lib/github";
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

  const connectedRepoMap = new Map(
    dbRepos.map((repo) => [repo.githubId.toString(), repo])
  );

  return githubRepos.map((repo: any) => {
    const connectedRepo = connectedRepoMap.get(repo.id.toString());
    const isConnected = Boolean(connectedRepo && !connectedRepo.disconnectedAt);

    return {
      ...repo,
      isConnected,
      indexStatus: isConnected ? connectedRepo?.indexStatus || "ready" : "disconnected",
      indexMessage: isConnected ? connectedRepo?.indexMessage || null : "Disconnected",
      indexedAt: isConnected ? connectedRepo?.indexedAt || null : null,
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

  const webhook = await createWebhook(owner , repo)

  if(webhook){
    if (existingRepo) {
      await prisma.repository.update({
        where: { id: existingRepo.id },
        data: {
          disconnectedAt: null,
          indexStatus: "indexing",
          indexMessage: "Indexing queued",
        },
      });
    } else {
      await prisma.repository.create({
        data:{
          githubId:BigInt(githubId),
          name:repo,
          owner,
          fullName:`${owner}/${repo}`,
          url:`https://github.com/${owner}/${repo}`,
          userId:session.user.id,
          indexStatus: "indexing",
          indexMessage: "Indexing queued",
        }
      })
    }

    await incrementRepositoryCount(session.user.id);

    try {
      await inngest.send({
        name: "repository.connected",
        data:{
          owner,
          repo,
          userId:session.user.id,
        }
      })
      
    } catch (error) {
      console.error("Failed to trigger repository indexing:", error);
    }
  }
  return webhook;
}
