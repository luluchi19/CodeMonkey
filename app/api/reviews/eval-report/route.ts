import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";

type EvalScores = {
  groundedness: number;
  relevance: number;
  contextRelevance: number;
  actionability: number;
  falsePositiveRisk: number;
  readability: number;
  brevity: number;
  coverage: number;
  honestHelpful: number;
  notes: string;
  model: string;
};

type MetricLegend = {
  metric: string;
  definition: string;
  goodThreshold: string;
  source: string;
};

const METRIC_LEGEND: MetricLegend[] = [
  {
    metric: "groundedness",
    definition: "Claims are supported by diff/context. / Các nhận định phải có bằng chứng từ diff/ngữ cảnh.",
    goodThreshold: ">= 4.0",
    source: "LAURA (truthfulness/M-Score motivation)",
  },
  {
    metric: "relevance",
    definition: "Comments focus on this PR and changed code. / Bình luận phải bám đúng PR và phần code thay đổi.",
    goodThreshold: ">= 4.0",
    source: "LAURA/RARe",
  },
  {
    metric: "contextRelevance",
    definition: "Retrieved context is useful for this PR. / Context truy xuất phải hữu ích cho PR này.",
    goodThreshold: ">= 3.5",
    source: "RAG best practices",
  },
  {
    metric: "actionability",
    definition: "Suggestions are concrete and feasible. / Gợi ý phải cụ thể và khả thi.",
    goodThreshold: ">= 3.5",
    source: "LAURA (Operability)",
  },
  {
    metric: "falsePositiveRisk",
    definition: "Higher means more misleading/incorrect claims. / Điểm cao hơn nghĩa là càng dễ có nhận định sai hoặc gây hiểu lầm.",
    goodThreshold: "<= 2.0",
    source: "LAURA (M-Score)",
  },
  {
    metric: "readability",
    definition: "Clear, easy-to-read language. / Ngôn ngữ rõ ràng, dễ đọc.",
    goodThreshold: ">= 3.5",
    source: "LAURA (Readability)",
  },
  {
    metric: "brevity",
    definition: "Concise without losing key points. / Ngắn gọn nhưng không mất ý chính.",
    goodThreshold: ">= 3.0",
    source: "LAURA (Brevity)",
  },
  {
    metric: "coverage",
    definition: "Covers important issues likely present. / Bao quát các vấn đề quan trọng có khả năng tồn tại.",
    goodThreshold: ">= 3.5",
    source: "LAURA (Sufficiency)",
  },
  {
    metric: "honestHelpful",
    definition: "Composite: truthfulness + relevance + actionability. / Điểm tổng hợp: tính đúng, mức liên quan và tính khả thi.",
    goodThreshold: ">= 3.5",
    source: "Derived (project rubric)",
  },
];

function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, v) => sum + v, 0);
  return Number((total / values.length).toFixed(3));
}

function parseScores(meta: unknown): EvalScores | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }

  const root = meta as Record<string, unknown>;
  const rawScores = root.scores;
  if (!rawScores || typeof rawScores !== "object" || Array.isArray(rawScores)) {
    return null;
  }

  const scores = rawScores as Record<string, unknown>;
  return {
    groundedness: toNumber(scores.groundedness),
    relevance: toNumber(scores.relevance),
    contextRelevance: toNumber(scores.contextRelevance),
    actionability: toNumber(scores.actionability),
    falsePositiveRisk: toNumber(scores.falsePositiveRisk),
    readability: toNumber(scores.readability),
    brevity: toNumber(scores.brevity),
    coverage: toNumber(scores.coverage),
    honestHelpful: toNumber(scores.honestHelpful),
    notes: typeof scores.notes === "string" ? scores.notes : "",
    model: typeof scores.model === "string" ? scores.model : "",
  };
}

function toCsv(
  rows: Array<Record<string, string | number>>,
  includeLegend: boolean
): string {
  if (rows.length === 0) {
    const emptyHeader =
      "reviewId,repo,prNumber,createdAt,groundedness,relevance,contextRelevance,actionability,falsePositiveRisk,readability,brevity,coverage,honestHelpful,model,notes\n";
    if (!includeLegend) return emptyHeader;
    const legendHeader = "metric,definition,goodThreshold,source\n";
    const legendLines = METRIC_LEGEND.map(
      (item) =>
        `"${item.metric}","${item.definition}","${item.goodThreshold}","${item.source}"`
    ).join("\n");
    return `${emptyHeader}\n${legendHeader}${legendLines}\n`;
  }

  const headers = Object.keys(rows[0]);
  const escaped = (value: string | number): string => {
    const text = String(value ?? "");
    const safe = text.replace(/"/g, '""');
    return `"${safe}"`;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escaped(row[h] ?? "")).join(","));
  }

  if (!includeLegend) {
    return `${lines.join("\n")}\n`;
  }

  const legendHeader = "metric,definition,goodThreshold,source";
  const legendLines = METRIC_LEGEND.map(
    (item) =>
      `"${item.metric}","${item.definition}","${item.goodThreshold}","${item.source}"`
  );
  return `${lines.join("\n")}\n\n${legendHeader}\n${legendLines.join("\n")}\n`;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format") || "json";
  const includeLegend = request.nextUrl.searchParams.get("includeLegend") !== "0";
  const limitRaw = request.nextUrl.searchParams.get("limit") || "200";
  const limit = Math.max(1, Math.min(1000, Number(limitRaw) || 200));

  const events = await prisma.reviewEvent.findMany({
    where: {
      message: "Review evaluation completed",
      review: {
        repository: {
          userId: session.user.id,
        },
      },
    },
    include: {
      review: {
        include: {
          repository: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  const rows = events
    .map((event) => {
      const scores = parseScores(event.meta);
      if (!scores) return null;

      return {
        reviewId: event.reviewId,
        repo: event.review.repository.fullName,
        prNumber: event.review.prNumber,
        createdAt: event.createdAt.toISOString(),
        groundedness: scores.groundedness,
        relevance: scores.relevance,
        contextRelevance: scores.contextRelevance,
        actionability: scores.actionability,
        falsePositiveRisk: scores.falsePositiveRisk,
        readability: scores.readability,
        brevity: scores.brevity,
        coverage: scores.coverage,
        honestHelpful: scores.honestHelpful,
        model: scores.model,
        notes: scores.notes,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const summary = {
    total: rows.length,
    groundednessAvg: avg(rows.map((r) => Number(r.groundedness))),
    relevanceAvg: avg(rows.map((r) => Number(r.relevance))),
    contextRelevanceAvg: avg(rows.map((r) => Number(r.contextRelevance))),
    actionabilityAvg: avg(rows.map((r) => Number(r.actionability))),
    falsePositiveRiskAvg: avg(rows.map((r) => Number(r.falsePositiveRisk))),
    coverageAvg: avg(rows.map((r) => Number(r.coverage))),
    honestHelpfulAvg: avg(rows.map((r) => Number(r.honestHelpful))),
  };

  if (format === "csv") {
    const csv = toCsv(rows, includeLegend);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=review-eval-report.csv",
      },
    });
  }

  return NextResponse.json({
    summary,
    rows,
    legend: METRIC_LEGEND,
  });
}
