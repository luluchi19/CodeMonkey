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
    review: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: number;
    status?: string;
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

  const review = await prisma.review.create({
    data: {
      repositoryId: repository.id,
      prNumber: payload.prNumber,
      prTitle: payload.prTitle,
      prUrl: payload.prUrl,
      review: payload.review,
      status: payload.status || "completed",
      inputTokens: payload.inputTokens,
      outputTokens: payload.outputTokens,
      estimatedCost: payload.estimatedCost,
    },
  });

  return NextResponse.json({ ok: true, reviewId: review.id });
}
