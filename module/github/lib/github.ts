import { Octokit } from "octokit";
import {auth} from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { types } from "util";

const WEBHOOK_SYNC_TTL_MS = 5 * 60 * 1000;
const webhookSyncCache = new Map<string, number>();

export const getGithubToken = async ()=>{
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if(!session){
        throw new Error("Unauthorized");
    }
    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: "github"
        }
    })

    if(!account?.accessToken){
        throw new Error("No Github access token found");
    }

    return account.accessToken;
}

export async function fetchUserContribution(token:string, username: string) {
    const octokit = new Octokit({ auth: token });

    const query = `
        query($username: String!) {
            user(login: $username) {
                contributionsCollection {
                    contributionCalendar {
                        totalContributions
                        weeks {
                            contributionDays {
                                contributionCount
                                date
                                color
                            }
                        }
                    }
                }
            }
        }
    `;

    

    try{
        const response: any = await octokit.graphql(query, {
            username
        })

        return response.user.contributionsCollection.contributionCalendar;
    }
    catch(error){
        console.error("Error fetching user contribution:", error);
        throw error;
    }
}

export const getRepositories = async (
  page: number = 1,
  perPage: number = 10
) => {
  const token = await getGithubToken();
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    direction: "desc",
    visibility: "all",
    per_page: perPage,
    page: page,
  });

  return data;
};

export const createWebhook = async (owner: string, repo: string) => {
  const token = await getGithubToken();
  const octokit = new Octokit({ auth: token });

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`;
  const webhookPath = "/api/webhooks/github";

  const { data: hooks } = await octokit.rest.repos.listWebhooks({
    owner,
    repo,
  });

  const existingHook = hooks.find((hook) => hook.config.url === webhookUrl);
  if (existingHook) {
    return existingHook;
  }

  const previousHook = hooks.find((hook) => {
    const url = hook.config.url;
    return typeof url === "string" && url.endsWith(webhookPath);
  });

  if (previousHook) {
    const { data } = await octokit.rest.repos.updateWebhook({
      owner,
      repo,
      hook_id: previousHook.id,
      config: {
        url: webhookUrl,
        content_type: "json",
      },
      events: ["pull_request"],
    });

    return data;
  }

  const { data } = await octokit.rest.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
    },
    events: ["pull_request"],
  });

  return data;
}

export const ensureRepositoryWebhook = async (owner: string, repo: string) => {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`;
  const cacheKey = `${owner}/${repo}:${webhookUrl}`;
  const now = Date.now();
  const lastSyncedAt = webhookSyncCache.get(cacheKey);

  if (lastSyncedAt && now - lastSyncedAt < WEBHOOK_SYNC_TTL_MS) {
    return;
  }

  webhookSyncCache.set(cacheKey, now);
  try {
    await createWebhook(owner, repo);
  } catch (error) {
    webhookSyncCache.delete(cacheKey);
    throw error;
  }
}

export const deleteWebhook = async (owner: string, repo: string) => {
  const token = await getGithubToken();
  const octokit = new Octokit({ auth: token });
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`;

  try {
    const { data: hooks } = await octokit.rest.repos.listWebhooks({
      owner,
      repo
    });

    const hookToDelete = hooks.find(
      hook => hook.config.url === webhookUrl
    );

    if (hookToDelete) {
      await octokit.rest.repos.deleteWebhook({
        owner,
        repo,
        hook_id: hookToDelete.id
      });
      return true;
    }
    return false;

  } catch (error) {
    console.error("Error deleting webhook:", error);
    return false;
  }
}

export async function getRepoFileContents(
  token: string,
  owner: string,
  repo: string,
  path: string = ""
): Promise<{ path: string; content: string }[]> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  });

  if (!Array.isArray(data)) {
    // It's a file
    if (data.type === "file" && data.content) {
      return [
        {
          path: data.path,
          content: Buffer.from(data.content, "base64").toString("utf-8"),
        },
      ];
    }
    return [];
  }

  let files: { path: string; content: string }[] = [];

  for (const item of data) {
    if (item.type === "file") {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: item.path,
      });

      if (
        !Array.isArray(fileData) &&
        fileData.type === "file" &&
        fileData.content
      ) {
        // Filter out non-code files if needed (images, etc.)
        // For now, let's include everything that looks like text
        if (!item.path.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i)) {
          files.push({
            path: item.path,
            content: Buffer.from(fileData.content, "base64").toString("utf-8"),
          });
        }
      }
    }
    else if (item.type === "dir") {
      const subFiles = await getRepoFileContents(token, owner, repo, item.path);
      files = files.concat(subFiles);
    }
  }

  return files;
}

export async function getPullRequestDiff(
  token:string,
  owner:string,
  repo:string,
  prNumber:number
){
  const octokit = new Octokit({auth:token});

  const {data:pr} = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number:prNumber
  })

  const {data:diff} = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number:prNumber,
    mediaType:{
      format:"diff"
    }
  });

  return {
    diff: diff as unknown as string,
    title: pr.title,
    description: pr.body || "",
    author: pr.user?.login || null,
    state: pr.state || null,
    createdAt: pr.created_at || null,
    mergedAt: pr.merged_at || null,
    baseRef: pr.base?.ref || null,
    headRef: pr.head?.ref || null,
    additions: typeof pr.additions === "number" ? pr.additions : null,
    deletions: typeof pr.deletions === "number" ? pr.deletions : null,
    changedFiles: typeof pr.changed_files === "number" ? pr.changed_files : null,
  }
}

export async function getPullRequestFiles(
  token: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<
  {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    blob_url: string;
  }[]
> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return data.map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch || undefined,
    blob_url: file.blob_url,
  }));
}

export async function getPullRequestDetails(
  token: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{
  title: string;
  author: string | null;
  state: string | null;
  createdAt: string | null;
  mergedAt: string | null;
  baseRef: string | null;
  headRef: string | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
}> {
  const octokit = new Octokit({ auth: token });
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return {
    title: pr.title,
    author: pr.user?.login || null,
    state: pr.state || null,
    createdAt: pr.created_at || null,
    mergedAt: pr.merged_at || null,
    baseRef: pr.base?.ref || null,
    headRef: pr.head?.ref || null,
    additions: typeof pr.additions === "number" ? pr.additions : null,
    deletions: typeof pr.deletions === "number" ? pr.deletions : null,
    changedFiles: typeof pr.changed_files === "number" ? pr.changed_files : null,
  };
}

export async function postReviewComment(
  token:string,
  owner:string,
  repo:string,
  prNumber:number,
  review:string
){
  const octokit = new Octokit({auth:token});

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number:prNumber,
    body: `## 🤖 AI Code Review\n\n${review}\n\n---\n*Powered by CodeMonkey*`,
  })
}
