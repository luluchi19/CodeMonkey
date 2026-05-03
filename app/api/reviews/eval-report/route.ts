import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { isMetricsAdmin } from "@/lib/access-control";

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
  // Metadata metrics (optional, computed from PR data)
  codeChurnRatio?: number;
  reviewCoverage?: number;
  suggestionDensity?: number;
  filesChanged?: number;
  reasoning?: string;
  keyIssuesMissed?: string;
};

type MetricLegend = {
  metric: string;
  definition: string;
  range: string;
  goodThreshold: string;
  source: string;
};

const METRIC_LEGEND: MetricLegend[] = [
  {
    metric: "groundedness",
    definition: "Claims are supported by diff/context. / Cac nhan dinh phai co bang chung tu diff/ngu canh.",
    range: "0-5",
    goodThreshold: ">= 4.0",
    source: "LAURA (truthfulness/M-Score motivation)",
  },
  {
    metric: "relevance",
    definition: "Comments focus on this PR and changed code. / Binh luan phai bam dung PR va phan code thay doi.",
    range: "0-5",
    goodThreshold: ">= 4.0",
    source: "LAURA/RARe",
  },
  {
    metric: "contextRelevance",
    definition: "Retrieved context is useful for this PR. / Context truy xuat phai huu ich cho PR nay.",
    range: "0-5",
    goodThreshold: ">= 3.5",
    source: "RAG best practices",
  },
  {
    metric: "actionability",
    definition: "Suggestions are concrete and feasible. / Goi y phai cu the va kha thi.",
    range: "0-5",
    goodThreshold: ">= 3.5",
    source: "LAURA (Operability)",
  },
  {
    metric: "falsePositiveRisk",
    definition: "Higher means more misleading/incorrect claims. / Diem cao hon nghia la cang de co nhan dinh sai hoac gay hieu lam.",
    range: "0-5",
    goodThreshold: "<= 2.0",
    source: "LAURA (M-Score)",
  },
  {
    metric: "readability",
    definition: "Clear, easy-to-read language. / Ngon ngu ro rang, de doc.",
    range: "0-5",
    goodThreshold: ">= 3.5",
    source: "LAURA (Readability)",
  },
  {
    metric: "brevity",
    definition: "Concise without losing key points. / Ngan gon nhung khong mat y chinh.",
    range: "0-5",
    goodThreshold: ">= 3.0",
    source: "LAURA (Brevity)",
  },
  {
    metric: "coverage",
    definition: "Covers important issues likely present. / Bao quat cac van de quan trong co kha nang ton tai.",
    range: "0-5",
    goodThreshold: ">= 3.5",
    source: "LAURA (Sufficiency)",
  },
  {
    metric: "honestHelpful",
    definition: "Composite: truthfulness + relevance + actionability. / Diem tong hop: tinh dung, muc lien quan va tinh kha thi.",
    range: "0-5",
    goodThreshold: ">= 3.5",
    source: "Derived (project rubric)",
  },
  // Metadata metrics (no LLM needed, computed from PR data)
  {
    metric: "codeChurnRatio",
    definition: "(additions + deletions) / estimated_total_lines. Measures PR size complexity. / Ti le thay doi code = (them + xoa) / tong dong. Do do phuc tap kich thuoc PR.",
    range: "0-1",
    goodThreshold: "<= 0.3",
    source: "GitHub PR metadata",
  },
  {
    metric: "reviewCoverage",
    definition: "Estimated % of changed lines mentioned in review. Higher = more comprehensive. / % dong thay doi duoc de cap trong review. Cao hon = bao phu tot hon.",
    range: "0-1",
    goodThreshold: ">= 0.3",
    source: "Computed from diff vs review text",
  },
  {
    metric: "suggestionDensity",
    definition: "Number of suggestions per PR size (normalized per 10-line chunk). Adjusted for PR size context. / So luong de xuat / kich thuoc PR. Thich hop cho PR lon/nho.",
    range: "0-5+",
    goodThreshold: ">= 0.5",
    source: "Review text analysis",
  },
  {
    metric: "filesChanged",
    definition: "Raw count of files modified in this PR. / Tong so file duoc thay doi trong PR nay.",
    range: "0-1000+",
    goodThreshold: "Info only",
    source: "GitHub PR metadata",
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
    // Metadata metrics (optional)
    codeChurnRatio: scores.codeChurnRatio ? toNumber(scores.codeChurnRatio) : undefined,
    reviewCoverage: scores.reviewCoverage ? toNumber(scores.reviewCoverage) : undefined,
    suggestionDensity: scores.suggestionDensity ? toNumber(scores.suggestionDensity) : undefined,
    filesChanged: scores.filesChanged ? toNumber(scores.filesChanged) : undefined,
    reasoning: typeof scores.reasoning === "string" ? scores.reasoning : undefined,
    keyIssuesMissed: typeof scores.keyIssuesMissed === "string" ? scores.keyIssuesMissed : undefined,
  };
}

function toCsv(
  rows: Array<Record<string, string | number>>,
  includeLegend: boolean
): string {
  if (rows.length === 0) {
    const emptyHeader =
      "reviewId,ownerId,ownerEmail,ownerName,ownerId,ownerEmail,ownerName,repo,prNumber,createdAt,groundedness,relevance,contextRelevance,actionability,falsePositiveRisk,readability,brevity,coverage,honestHelpful,codeChurnRatio,filesChanged,reviewCoverage,suggestionDensity,model,notes\n";
    if (!includeLegend) return "\ufeff" + emptyHeader;
    const legendHeader = "metric,definition,range,goodThreshold,source\n";
    const legendLines = METRIC_LEGEND.map(
      (item) =>
        `"${item.metric}","${item.definition}","${item.range}","${item.goodThreshold}","${item.source}"`
    ).join("\n");
    return "\ufeff" + `${emptyHeader}\n${legendHeader}${legendLines}\n`;
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
    return "\ufeff" + `${lines.join("\n")}\n`;
  }

  const legendHeader = "metric,definition,range,goodThreshold,source";
  const legendLines = METRIC_LEGEND.map(
    (item) =>
      `"${item.metric}","${item.definition}","${item.range}","${item.goodThreshold}","${item.source}"`
  );
  return "\ufeff" + `${lines.join("\n")}\n\n${legendHeader}\n${legendLines.join("\n")}\n`;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only whitelisted users can access all metrics/eval reports
  if (!isMetricsAdmin(session)) {
    return NextResponse.json(
      { error: "Forbidden: Only authorized admins can access evaluation reports" },
      { status: 403 }
    );
  }

  const format = request.nextUrl.searchParams.get("format") || "json";
  const includeLegend = request.nextUrl.searchParams.get("includeLegend") !== "0";
  const limitRaw = request.nextUrl.searchParams.get("limit") || "200";
  const limit = Math.max(1, Math.min(1000, Number(limitRaw) || 200));

  // Admin can view all evaluation metrics (no userId filter)
  const events = await prisma.reviewEvent.findMany({
    where: {
      message: "Review evaluation completed",
    },
    include: {
      review: {
        include: {
          repository: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
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
        ownerId: event.review.repository.user.id,
        ownerEmail: event.review.repository.user.email,
        ownerName: event.review.repository.user.name,
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
