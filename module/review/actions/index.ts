"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getGithubToken,
  getPullRequestDetails,
  getPullRequestFiles,
} from "@/module/github/lib/github";

export async function getReviews() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    throw new Error("Unauthorized")
  }

  const reviews = await prisma.review.findMany({
    where:{
      repository:{
        userId:session.user.id
      }
    },
    include:{
      repository:true,
      events: {
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy:{
      createdAt:"desc"
    },
    take:50
  })

  return reviews
}

export async function getReviewDetail(reviewId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const review = await prisma.review.findFirst({
    where: {
      id: reviewId,
      repository: {
        userId: session.user.id,
      },
    },
    include: {
      repository: true,
      events: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  const token = await getGithubToken();
  const { owner, name } = review.repository;

  let prDetails = {
    title: review.prTitle,
    author: review.prAuthor,
    state: review.prState,
    createdAt: review.prCreatedAt?.toISOString() || null,
    mergedAt: review.prMergedAt?.toISOString() || null,
    baseRef: review.baseRef,
    headRef: review.headRef,
    additions: review.additions,
    deletions: review.deletions,
    changedFiles: review.changedFiles,
  };

  if (!review.baseRef || !review.headRef || !review.prState) {
    const liveDetails = await getPullRequestDetails(
      token,
      owner,
      name,
      review.prNumber
    );
    prDetails = {
      title: liveDetails.title || prDetails.title,
      author: liveDetails.author || prDetails.author,
      state: liveDetails.state || prDetails.state,
      createdAt: liveDetails.createdAt || prDetails.createdAt,
      mergedAt: liveDetails.mergedAt || prDetails.mergedAt,
      baseRef: liveDetails.baseRef || prDetails.baseRef,
      headRef: liveDetails.headRef || prDetails.headRef,
      additions: liveDetails.additions ?? prDetails.additions,
      deletions: liveDetails.deletions ?? prDetails.deletions,
      changedFiles: liveDetails.changedFiles ?? prDetails.changedFiles,
    };
  }

  let files: Awaited<ReturnType<typeof getPullRequestFiles>> = [];
  try {
    files = await getPullRequestFiles(token, owner, name, review.prNumber);
  } catch (error) {
    console.error("Failed to load PR files:", error);
  }

  return {
    review: {
      id: review.id,
      prNumber: review.prNumber,
      prTitle: review.prTitle,
      prUrl: review.prUrl,
      review: review.review,
      status: review.status,
      inputTokens: review.inputTokens,
      outputTokens: review.outputTokens,
      estimatedCost: review.estimatedCost,
      createdAt: review.createdAt.toISOString(),
      startedAt: review.startedAt?.toISOString() || null,
      completedAt: review.completedAt?.toISOString() || null,
      repository: {
        id: review.repository.id,
        fullName: review.repository.fullName,
        owner: review.repository.owner,
        name: review.repository.name,
        url: review.repository.url,
      },
      events: review.events.map((event) => ({
        id: event.id,
        level: event.level,
        message: event.message,
        meta: event.meta,
        createdAt: event.createdAt.toISOString(),
      })),
      prDetails,
    },
    files,
  };
}
