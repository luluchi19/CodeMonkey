import prisma from "@/lib/db";
import { inngest } from "../client";
import { postToPythonSidecar } from "@/lib/python-sidecar";

export const disconnectRepoVectors = inngest.createFunction(
  { id: "disconnect-repo-vectors" },
  { event: "repository.disconnected" },
  async ({ event, step }) => {
    const { owner, repo, userId, repositoryId, reason } = event.data as {
      owner: string;
      repo: string;
      userId: string;
      repositoryId: string;
      reason?: string;
    };

    await step.run("log-disconnect-start", async () => {
      await prisma.repository.updateMany({
        where: { id: repositoryId, userId },
        data: {
          indexStatus: "ready",
          indexMessage: reason ? `Disconnected: ${reason}` : "Disconnected",
        },
      });
    });

    const result = await step.run("forward-delete-vectors", async () => {
      return await postToPythonSidecar("/inngest/repo-disconnect", {
        owner,
        repo,
        userId,
        repositoryId,
        reason,
      });
    });

    await step.run("log-disconnect-complete", async () => {
      await prisma.repository.updateMany({
        where: { id: repositoryId, userId },
        data: {
          indexMessage:
            typeof result === "object"
              ? "Disconnected and vector cleanup completed"
              : "Disconnected",
        },
      });
    });

    return { success: true, deleted: true };
  }
);