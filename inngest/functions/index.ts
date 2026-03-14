import prisma from "@/lib/db";
import { inngest } from "../client";
import { postToPythonSidecar } from "@/lib/python-sidecar";

export const indexRepo = inngest.createFunction(
  { id: "index-repo" },
  { event: "repository.connected" },

  async ({ event, step }) => {
    const { owner, repo, userId } = event.data

    const token = await step.run("resolve-token", async () => {
      const account = await prisma.account.findFirst({
        where: {
          userId: userId,
          providerId: "github",
        },
      })

      if (!account?.accessToken) {
        throw new Error("No Github access token found for user")
      }

      return account.accessToken
    })

    await step.run("forward-to-python", async () => {
      return await postToPythonSidecar("/inngest/repo-index", {
        owner,
        repo,
        userId,
        token,
      })
    })

    return { success: true, forwarded: true }
  }
)
