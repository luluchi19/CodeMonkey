import prisma from "@/lib/db";
import { inngest } from "../client";
import { postToPythonSidecar } from "@/lib/python-sidecar";
import { decrementRepositoryCount } from "@/module/payment/lib/subscription";

export { disconnectRepoVectors } from "./disconnect";

export const indexRepo = inngest.createFunction(
  { id: "index-repo" },
  { event: "repository.connected" },

  async ({ event, step }) => {
    const { owner, repo, userId } = event.data

    const markDisconnectedAfterFailure = async (reason: string) => {
      await step.run("reset-repository-disconnected", async () => {
        const result = await prisma.repository.updateMany({
          where: {
            owner,
            name: repo,
            userId,
            disconnectedAt: null,
          },
          data: {
            disconnectedAt: new Date(),
            indexStatus: "ready",
            indexMessage: `Disconnected after indexing error: ${reason}`,
            indexedAt: null,
          },
        });

        if (result.count > 0) {
          await decrementRepositoryCount(userId, result.count);
        }
      });
    };

    let token: string;
    let forwardResult: unknown;

    try {
      token = await step.run("resolve-token", async () => {
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
        error instanceof Error ? error.message : "Repository indexing failed";
      await markDisconnectedAfterFailure(message);
      throw error;
    }

    await step.run("mark-index-ready", async () => {
      let message = "Indexing complete"

      if (forwardResult && typeof forwardResult === "object") {
        const result = forwardResult as {
          result?: { filesIndexed?: number }
        }
        if (typeof result.result?.filesIndexed === "number") {
          message = `Indexed ${result.result.filesIndexed} files`
        }
      }

      await prisma.repository.updateMany({
        where: {
          owner,
          name: repo,
          userId,
          disconnectedAt: null,
        },
        data: {
          indexStatus: "ready",
          indexMessage: message,
          indexedAt: new Date(),
        },
      })
    })

    return { success: true, forwarded: true }
  }
)
