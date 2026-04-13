import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

function verifySignature(body: string, timestamp: string, signature: string): boolean {
  const secret = process.env.PYTHON_SIDECAR_SECRET || "";
  if (!secret) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const timestamp = request.headers.get("x-cm-timestamp") || "";
  const signature = request.headers.get("x-cm-signature") || "";
  const rawBody = await request.text();

  if (!timestamp || !signature || !verifySignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    owner: string;
    repo: string;
    prNumber: number;
    prTitle: string;
    prUrl: string;
    prAuthor?: string | null;
    prState?: string | null;
    prCreatedAt?: string | null;
    prMergedAt?: string | null;
    baseRef?: string | null;
    headRef?: string | null;
    additions?: number | null;
    deletions?: number | null;
    changedFiles?: number | null;
    review: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: number;
    status?: string;
    reviewId?: string;
  };

  const repository = await prisma.repository.findFirst({
    where: {
      owner: payload.owner,
      name: payload.repo,
    },
  });

  if (!repository) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const existing = payload.reviewId
    ? await prisma.review.findUnique({ where: { id: payload.reviewId } })
    : await prisma.review.findFirst({
        where: {
          repositoryId: repository.id,
          prNumber: payload.prNumber,
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
      });

  const status = payload.status || "completed";
  const isFinalStatus = status === "completed" || status === "failed";

  const review = existing
    ? await prisma.review.update({
        where: { id: existing.id },
        data: {
          prTitle: payload.prTitle || existing.prTitle,
          prUrl: payload.prUrl || existing.prUrl,
          prAuthor: payload.prAuthor ?? existing.prAuthor,
          prState: payload.prState ?? existing.prState,
          prCreatedAt: payload.prCreatedAt
            ? new Date(payload.prCreatedAt)
            : existing.prCreatedAt,
          prMergedAt: payload.prMergedAt
            ? new Date(payload.prMergedAt)
            : existing.prMergedAt,
          baseRef: payload.baseRef ?? existing.baseRef,
          headRef: payload.headRef ?? existing.headRef,
          additions: payload.additions ?? existing.additions,
          deletions: payload.deletions ?? existing.deletions,
          changedFiles: payload.changedFiles ?? existing.changedFiles,
          review: payload.review,
          status,
          inputTokens: payload.inputTokens,
          outputTokens: payload.outputTokens,
          estimatedCost: payload.estimatedCost,
          completedAt: isFinalStatus ? new Date() : existing.completedAt,
        },
      })
    : await prisma.review.create({
        data: {
          repositoryId: repository.id,
          prNumber: payload.prNumber,
          prTitle: payload.prTitle,
            prAuthor: payload.prAuthor ?? null,
            prState: payload.prState ?? null,
            prCreatedAt: payload.prCreatedAt ? new Date(payload.prCreatedAt) : null,
            prMergedAt: payload.prMergedAt ? new Date(payload.prMergedAt) : null,
            baseRef: payload.baseRef ?? null,
            headRef: payload.headRef ?? null,
            additions: payload.additions ?? null,
            deletions: payload.deletions ?? null,
            changedFiles: payload.changedFiles ?? null,
          prUrl: payload.prUrl,
          review: payload.review,
          status,
          inputTokens: payload.inputTokens,
          outputTokens: payload.outputTokens,
          estimatedCost: payload.estimatedCost,
          completedAt: isFinalStatus ? new Date() : null,
        },
      });

  return NextResponse.json({ ok: true, reviewId: review.id });
}
