"use server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { deleteWebhook } from "@/module/github/lib/github";
import { decrementRepositoryCount } from "@/module/payment/lib/subscription";

const REVIEW_SECTION_KEYS = new Set([
  "walkthrough",
  "sequence_diagram",
  "summary",
  "strengths",
  "issues",
  "suggestions",
  "tests",
  "references",
  "risk_score",
  "poem",
]);

export async function getUserProfile() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        reviewLanguage: true,
        reviewSections: true,
        reviewAuditEnabled: true,
        subscriptionTier: true,
      }
    })

    return user;

  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function updateUserProfile(data: {
  name?: string;
  email?: string;
  reviewLanguage?: string;
  reviewSections?: string[];
  reviewAuditEnabled?: boolean;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const filteredSections = data.reviewSections
      ? data.reviewSections.filter((section) => REVIEW_SECTION_KEYS.has(section))
      : undefined;

    const reviewAuditEnabled =
      typeof data.reviewAuditEnabled === "boolean"
        ? data.reviewAuditEnabled
        : undefined;

    const updateUser = await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        name: data.name,
        email: data.email,
        reviewLanguage: data.reviewLanguage,
        reviewSections: filteredSections,
        reviewAuditEnabled,
      },
      select: {
        id: true,
        name: true,
        email: true,
        reviewSections: true,
        reviewAuditEnabled: true,
      }
    });

    revalidatePath("/dashboard/settings", "page");

    return {
      success: true,
      user: updateUser,
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      error: "Failed to update user profile",
    }
  }
}

export async function getConnectedRepositories() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const repositories = await prisma.repository.findMany({
      where: {
        userId: session.user.id,
        disconnectedAt: null,
      },
      select: {
        id: true,
        name: true,
        fullName: true,
        url: true,
        createdAt: true,
        indexStatus: true,
        indexMessage: true,
        indexedAt: true,
      },
      orderBy: {
        createdAt: "desc"
      }
    })
    return repositories;

  } catch (error) {
    console.error("Error fetching connected repositories:", error);
    return [];
  }
}

export async function disconnectRepository(repositoryId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const repository = await prisma.repository.findUnique({
      where: {
        id: repositoryId,
        userId: session.user.id
      }
    })

    if (!repository) {
      throw new Error("Repository not found")
    }

    await deleteWebhook(repository.owner, repository.name)

    await prisma.repository.update({
      where: {
        id: repositoryId,
        userId: session.user.id
      },
      data: {
        disconnectedAt: new Date(),
      },
    });

    await decrementRepositoryCount(session.user.id, 1);

    revalidatePath("/dashboard/settings", "page")
    revalidatePath("/dashboard/repository", "page")
    return { success: true }

  } catch (error) {
    console.error("Error disconnecting repository:", error);
    return { success: false, error: "Failed to disconnect repository" }
  }
}

export async function disconnectAllRepositories() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      throw new Error("Unauthorized")
    }

    const repositories = await prisma.repository.findMany({
      where: {
        userId: session.user.id,
        disconnectedAt: null,
      },
    })

    await Promise.all(repositories.map(async (repo) => {
      await deleteWebhook(repo.owner, repo.name)
    }));

    const result = await prisma.repository.updateMany({
      where: {
        userId: session.user.id,
        disconnectedAt: null,
      },
      data: {
        disconnectedAt: new Date(),
      },
    })

    if (result.count > 0) {
      await decrementRepositoryCount(session.user.id, result.count);
    }

    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/repository")
    return { success: true, count: result.count }
  } catch (error) {
    console.error("Error disconnecting all repositories:", error);
    return { success: false, error: "Failed to disconnect all repositories" }
  }
}

