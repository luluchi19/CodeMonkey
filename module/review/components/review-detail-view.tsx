"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  GitPullRequest,
  ExternalLink,
  CalendarClock,
  User,
  GitBranch,
  Plus,
  Minus,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const RISK_LABELS: Record<number, string> = {
  0: "Masterpiece",
  1: "Very Safe",
  2: "Steady",
  3: "Caution",
  4: "Risky",
  5: "Super Dangerous",
};

type ReviewDetail = {
  review: {
    id: string;
    prNumber: number;
    prTitle: string;
    prUrl: string;
    review: string;
    status: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    estimatedCost?: number | null;
    createdAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    repository: {
      id: string;
      fullName: string;
      owner: string;
      name: string;
      url: string;
    };
    events: {
      id: string;
      level: string;
      message: string;
      meta: any;
      createdAt: string;
    }[];
    prDetails: {
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
    };
  };
  files: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    blob_url: string;
  }[];
};

export function ReviewDetailView({ data }: { data: ReviewDetail }) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const riskScore = useMemo(() => {
    const match = data.review.review.match(/risk score[^0-9]*([0-5])(\s*\/\s*5)?/i);
    if (!match) return null;
    const score = Number(match[1]);
    return Number.isNaN(score) ? null : score;
  }, [data.review.review]);

  const riskLabel = riskScore !== null ? RISK_LABELS[riskScore] : null;
  const riskPercent = riskScore !== null ? Math.round((riskScore / 5) * 100) : 0;

  const stateLabel = data.review.prDetails.mergedAt
    ? "Merged"
    : data.review.prDetails.state === "closed"
      ? "Closed"
      : "Open";

  const stateVariant = data.review.prDetails.mergedAt
    ? "secondary"
    : data.review.prDetails.state === "closed"
      ? "destructive"
      : "default";

  const createdAt = data.review.prDetails.createdAt
    ? new Date(data.review.prDetails.createdAt)
    : new Date(data.review.createdAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Badge variant="outline">Review detail</Badge>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <GitPullRequest className="h-5 w-5 text-primary" />
                <CardTitle className="text-2xl">{data.review.prDetails.title}</CardTitle>
                <Badge variant={stateVariant}>{stateLabel}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <GitPullRequest className="h-4 w-4" />
                  #{data.review.prNumber}
                </span>
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {data.review.prDetails.author || "Unknown"}
                </span>
                <span className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  {format(createdAt, "MMM d, yyyy")} ({formatDistanceToNow(createdAt, { addSuffix: true })})
                </span>
              </div>
            </div>

            <Button variant="outline" asChild>
              <a href={data.review.prUrl} target="_blank" rel="noopener noreferrer">
                View on GitHub
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary" className="gap-2">
              <GitBranch className="h-4 w-4" />
              {data.review.prDetails.headRef || "unknown"}
            </Badge>
            <span className="text-muted-foreground">into</span>
            <Badge variant="outline" className="gap-2">
              <GitBranch className="h-4 w-4" />
              {data.review.prDetails.baseRef || "unknown"}
            </Badge>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-1">
                <Plus className="h-4 w-4 text-emerald-600" />
                {data.review.prDetails.additions ?? 0}
              </span>
              <span className="flex items-center gap-1">
                <Minus className="h-4 w-4 text-rose-600" />
                {data.review.prDetails.deletions ?? 0}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {data.review.prDetails.changedFiles ?? data.files.length} files
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {riskScore !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Risk score</span>
                <Badge variant="outline">
                  {riskScore}/5 {riskLabel ? `• ${riskLabel}` : ""}
                </Badge>
              </div>
              <div className="relative h-2 rounded-full bg-muted">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                  style={{ width: `${riskPercent}%` }}
                />
                <div
                  className="absolute -top-1 h-4 w-4 rounded-full border-2 border-background bg-foreground"
                  style={{ left: `calc(${riskPercent}% - 8px)` }}
                />
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 p-4">
            <div className={`relative ${isExpanded ? "" : "max-h-64 overflow-hidden"}`}>
              <pre className="whitespace-pre-wrap text-sm text-foreground/90">
                {data.review.review}
              </pre>
              {!isExpanded && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-muted/90 to-transparent" />
              )}
            </div>
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setIsExpanded((value) => !value)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                {isExpanded ? "Show less" : "Load more"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files changed</CardTitle>
        </CardHeader>
        <CardContent>
          {data.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files found for this pull request.</p>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {data.files.map((file) => (
                <AccordionItem key={file.filename} value={file.filename} className="border rounded-lg">
                  <AccordionTrigger className="px-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-medium text-foreground">{file.filename}</span>
                      <Badge variant="outline" className="capitalize">
                        {file.status}
                      </Badge>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Plus className="h-3 w-3 text-emerald-600" />
                        {file.additions}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Minus className="h-3 w-3 text-rose-600" />
                        {file.deletions}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {file.changes} changes
                      </p>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={file.blob_url} target="_blank" rel="noopener noreferrer">
                          View file
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                    {file.patch ? (
                      <pre className="mt-3 whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs text-foreground/90">
                        {file.patch}
                      </pre>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Patch is too large to display. Open the file on GitHub to view the full diff.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
