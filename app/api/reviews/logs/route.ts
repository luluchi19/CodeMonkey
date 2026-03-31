import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/browser";


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
    reviewId: string;
    level?: "info" | "warn" | "error";
    message: string;
    meta?: Record<string, unknown>;
  };

  if (!payload.reviewId || !payload.message) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const meta = payload.meta || {};
  const metaRecord = typeof meta === "object" && meta !== null && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : null;

  await prisma.reviewEvent.create({
    data: {
      reviewId: payload.reviewId,
      level: payload.level || "info",
      message: payload.message,
      meta: meta as Prisma.InputJsonValue,
    },
  });

  const finalStatus =
    typeof metaRecord?.finalStatus === "string" ? metaRecord.finalStatus : null;
  const reviewText =
    typeof metaRecord?.reviewText === "string" ? metaRecord.reviewText : null;

  if (finalStatus || reviewText) {
    await prisma.review.update({
      where: { id: payload.reviewId },
      data: {
        status:
          finalStatus === "completed" || finalStatus === "failed"
            ? finalStatus
            : undefined,
        completedAt:
          finalStatus === "completed" || finalStatus === "failed"
            ? new Date()
            : undefined,
        review: reviewText || undefined,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
