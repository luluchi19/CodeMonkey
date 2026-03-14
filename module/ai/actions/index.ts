"use server";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { getPullRequestDiff } from "@/module/github/lib/github";
import { canCreateReview, incrementReviewCount } from "@/module/payment/lib/subscription";

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
          include:{
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

    const { title } = await getPullRequestDiff(token, owner, repo, prNumber);

    console.log(`PR title fetched: ${title}`);

    await inngest.send({
      name:"pr.review.requested",
      data:{
        owner,
        repo,
        prNumber,
        userId: repository.user.id,
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
        await prisma.review.create({
          data:{
            repositoryId:repository.id,
            prNumber,
            prTitle:"Failed to fetch PR",
            prUrl:`https://github.com/${owner}/${repo}/pull/${prNumber}`,
            review:`Error: ${error instanceof Error ? error.message : "Unknown Error"}`,
            status:"failed"
          }
        })
      }
    } catch (dbError) {
      console.error("Failed to create failed review in database:", dbError);
    }
  }
}
