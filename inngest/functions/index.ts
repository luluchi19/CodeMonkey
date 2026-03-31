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

    await step.run("mark-indexing", async () => {
      await prisma.repository.updateMany({
        where: {
          owner,
          name: repo,
          userId,
        },
        data: {
          indexStatus: "indexing",
          indexMessage: "Indexing in progress",
        },
      })
    })

    let forwardResult: unknown
    try {
      forwardResult = await step.run("forward-to-python", async () => {
        return await postToPythonSidecar("/inngest/repo-index", {
          owner,
          repo,
          userId,
          token,
        })
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Repository indexing failed"

      await step.run("mark-index-failed", async () => {
        await prisma.repository.updateMany({
          where: {
            owner,
            name: repo,
            userId,
          },
          data: {
            indexStatus: "failed",
            indexMessage: message,
          },
        })
      })

      throw error
    }

    await step.run("mark-index-ready", async () => {
      let status = "ready"
      let message = "Indexing complete"

      if (forwardResult && typeof forwardResult === "object") {
        const result = forwardResult as {
          result?: { warning?: string; filesIndexed?: number }
        }
        if (result.result?.warning) {
          status = "warning"
          message = result.result.warning
        } else if (typeof result.result?.filesIndexed === "number") {
          message = `Indexed ${result.result.filesIndexed} files`
        }
      }

      await prisma.repository.updateMany({
        where: {
          owner,
          name: repo,
          userId,
        },
        data: {
          indexStatus: status,
          indexMessage: message,
          indexedAt: new Date(),
        },
      })
    })

    return { success: true, forwarded: true }
  }
)
