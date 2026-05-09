"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalyticsData } from "@/module/analytics/actions";
import Link from "next/link";

const tooltipStyle = {
  backgroundColor: "var(--background)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};

type AnalyticsDashboardProps = {
  data: AnalyticsData;
};

export default function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  if (!data.isPro) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Analytics (PRO)</CardTitle>
          <CardDescription>
            Upgrade to PRO to unlock deep review analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Track tokens, review volume, and trends across time windows.
          </p>
          <Button asChild>
            <Link href="/dashboard/subscription">Upgrade to PRO</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const summary = data.summary;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-50 via-background to-slate-100 p-8">
        <div className="absolute -top-16 right-10 h-40 w-40 rounded-full bg-amber-200/60 blur-3xl" />
        <div className="absolute -bottom-20 left-6 h-48 w-48 rounded-full bg-slate-200/60 blur-3xl" />
        <div className="relative space-y-3">
          <Badge variant="secondary" className="w-fit">PRO Analytics</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Review Intelligence Lab</h1>
          <p className="text-muted-foreground max-w-2xl">
            Observe how your review traffic, token usage, and completion health
            evolve across daily, weekly, monthly, and yearly horizons.
          </p>
        </div>
      </section>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalReviews}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Input + output</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Tokens / Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgTokensPerReview.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Smoothed across reviews</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.successRate}%</div>
              <p className="text-xs text-muted-foreground">Completed reviews</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-amber-200/60">
          <CardHeader>
            <CardTitle>Daily Tokens</CardTitle>
            <CardDescription>Last 14 days of output volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyTokens}>
                  <defs>
                    <linearGradient id="dailyTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="var(--chart-2)"
                    fill="url(#dailyTokens)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>Weekly Review Volume</CardTitle>
            <CardDescription>Rolling 12-week cadence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklyReviews}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="reviews" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/60">
          <CardHeader>
            <CardTitle>Monthly Token Mix</CardTitle>
            <CardDescription>Input vs output consumption (12 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyTokens}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="inputTokens" stackId="tokens" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="outputTokens" stackId="tokens" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>Yearly Token Trajectory</CardTitle>
            <CardDescription>Multi-year signal for scale planning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.yearlyTokens}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="tokens"
                    stroke="var(--chart-5)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
