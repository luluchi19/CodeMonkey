"use server";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { getPullRequestDiff } from "@/module/github/lib/github";
import { canCreateReview, incrementReviewCount } from "@/module/payment/lib/subscription";
import { getMaxTokensPerPr } from "@/module/payment/lib/limits";

export async function reviewPullRequest(
  owner:string,
  repo:string,
  prNumber:number
){

  try {
    console.log(`ReviewPullRequest start: ${owner}/${repo} #${prNumber}`);

    const repository = await prisma.repository.findFirst({
      where:{
        owner,
        name:repo
      },
      include:{
        user:{
          select:{
            id: true,
            name: true,
            subscriptionTier: true,
            reviewLanguage: true,
            reviewSections: true,
            reviewAuditEnabled: true,
            accounts:{
              where:{
                providerId:"github"
              }
            }
          }
        }
      }
    })

    if(!repository){
      throw new Error(`Repository ${owner}/${repo} not found in database. Please reconnect the repository.`);
    }

    console.log(`Repository found: ${repository.id}`);

    const canReview = await canCreateReview(repository.user.id, repository.id);

    if(!canReview){
      throw new Error(`User ${repository.user.name} has reached the review limit for repository ${owner}/${repo}. Please upgrade your subscription to PRO or wait until the limit resets.`);
    }

    console.log("Review limit OK");

    const githubAccount = repository.user.accounts[0];

    if(!githubAccount?.accessToken){
      throw new Error(`GitHub account not found for user ${repository.user.name}. Please reconnect the repository.`);
    }

    console.log("GitHub token OK");

    const token = githubAccount.accessToken;

    const prDetails = await getPullRequestDiff(token, owner, repo, prNumber);
    const title = prDetails.title;

    console.log(`PR title fetched: ${title}`);

    const pendingReview = await prisma.review.create({
      data:{
        repositoryId: repository.id,
        prNumber,
        prTitle: title || "Review in progress",
        prAuthor: prDetails.author || null,
        prState: prDetails.state || null,
        prCreatedAt: prDetails.createdAt ? new Date(prDetails.createdAt) : null,
        prMergedAt: prDetails.mergedAt ? new Date(prDetails.mergedAt) : null,
        baseRef: prDetails.baseRef || null,
        headRef: prDetails.headRef || null,
        additions: prDetails.additions ?? null,
        deletions: prDetails.deletions ?? null,
        changedFiles: prDetails.changedFiles ?? null,
        prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
        review: "Review in progress.",
        status: "pending",
        startedAt: new Date()
      }
    });

    await prisma.reviewEvent.create({
      data: {
        reviewId: pendingReview.id,
        level: "info",
        message: "Review requested",
        meta: {
          owner,
          repo,
          prNumber,
        },
      },
    });

    const maxPrTokens = getMaxTokensPerPr(repository.user.subscriptionTier as "FREE" | "PRO");

    await inngest.send({
      name:"pr.review.requested",
      data:{
        owner,
        repo,
        prNumber,
        userId: repository.user.id,
        reviewId: pendingReview.id,
        subscriptionTier: repository.user.subscriptionTier,
        reviewLanguage: repository.user.reviewLanguage,
        reviewSections: repository.user.reviewSections || [],
        reviewAuditEnabled: Boolean(repository.user.reviewAuditEnabled),
        reviewAuditEnabledSource: repository.user.reviewAuditEnabled ? "user" : "none",
        maxPrTokens,
      }
    });

    console.log("Inngest event sent: pr.review.requested");

    await incrementReviewCount(repository.user.id, repository.id);

    return {success: true, message: "Pull request review requested"};
  } catch (error) {
    console.error("Review request failed:", error);
    try {
      const repository = await prisma.repository.findFirst({
        where:{
          owner,
          name:repo
        },
      })
      
      if(repository){
        const existing = await prisma.review.findFirst({
          where:{
            repositoryId: repository.id,
            prNumber,
            status: "pending"
          },
          orderBy:{
            createdAt: "desc"
          }
        });

        if (existing) {
          await prisma.review.update({
            where: { id: existing.id },
            data: {
              prTitle: existing.prTitle || "Failed to fetch PR",
              prUrl: existing.prUrl || `https://github.com/${owner}/${repo}/pull/${prNumber}`,
              review: `Error: ${error instanceof Error ? error.message : "Unknown Error"}`,
              status: "failed",
              completedAt: new Date(),
            }
          });

          await prisma.reviewEvent.create({
            data: {
              reviewId: existing.id,
              level: "error",
              message: "Review failed before dispatch",
              meta: {
                error: error instanceof Error ? error.message : "Unknown Error",
              },
            },
          });
        } else {
          await prisma.review.create({
            data:{
              repositoryId:repository.id,
              prNumber,
              prTitle:"Failed to fetch PR",
              prUrl:`https://github.com/${owner}/${repo}/pull/${prNumber}`,
              review:`Error: ${error instanceof Error ? error.message : "Unknown Error"}`,
              status:"failed",
              completedAt: new Date(),
            }
          })
        }
      }
    } catch (dbError) {
      console.error("Failed to create failed review in database:", dbError);
    }
  }
}
