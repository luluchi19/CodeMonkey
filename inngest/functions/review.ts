import { inngest } from "../client";
import prisma from "@/lib/db";
import { postToPythonSidecar } from "@/lib/python-sidecar";

export const generateReview = inngest.createFunction(
  {id:"generate-review", concurrency:5},
  {event:"pr.review.requested"},

  async ({event , step})=>{
    const {owner , repo , prNumber , userId , reviewId , subscriptionTier , reviewLanguage , maxPrTokens} = event.data;

    const token = await step.run("resolve-token", async()=>{
      const account = await prisma.account.findFirst({
        where:{
          userId:userId,
          providerId:"github"
        }
      })

      if(!account?.accessToken){
        throw new Error(`No Github access token found for user ${userId}`);
      }

      return account.accessToken;
    });

    await step.run("forward-to-python", async()=>{
      console.log(`Forwarding PR review to Python: ${owner}/${repo} #${prNumber}`);
      return await postToPythonSidecar("/inngest/pr-review", {
        owner,
        repo,
        prNumber,
        userId,
        reviewId,
        subscriptionTier,
        reviewLanguage,
        maxPrTokens,
        token,
      });
    });

    console.log(`PR review forwarded to Python: ${owner}/${repo} #${prNumber}`);
    return {success: true, forwarded: true};
  }
)
