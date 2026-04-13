"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

export type AnalyticsSummary = {
  totalReviews: number;
  totalTokens: number;
  avgTokensPerReview: number;
  successRate: number;
};

export type DailyTokensPoint = {
  date: string;
  tokens: number;
};

export type WeeklyReviewsPoint = {
  week: string;
  reviews: number;
};

export type MonthlyTokensPoint = {
  month: string;
  inputTokens: number;
  outputTokens: number;
};

export type YearlyTokensPoint = {
  year: string;
  tokens: number;
};

export type AnalyticsData = {
  isPro: boolean;
  summary: AnalyticsSummary | null;
  dailyTokens: DailyTokensPoint[];
  weeklyReviews: WeeklyReviewsPoint[];
  monthlyTokens: MonthlyTokensPoint[];
  yearlyTokens: YearlyTokensPoint[];
};

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      isPro: false,
      summary: null,
      dailyTokens: [],
      weeklyReviews: [],
      monthlyTokens: [],
      yearlyTokens: [],
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionTier: true },
  });

  const isPro = user?.subscriptionTier === "PRO";
  if (!isPro) {
    return {
      isPro: false,
      summary: null,
      dailyTokens: [],
      weeklyReviews: [],
      monthlyTokens: [],
      yearlyTokens: [],
    };
  }

  const reviews = await prisma.review.findMany({
    where: {
      repository: {
        userId: session.user.id,
      },
    },
    select: {
      createdAt: true,
      inputTokens: true,
      outputTokens: true,
      status: true,
    },
  });

  const now = new Date();

  const dailyStart = subDays(now, 13);
  const weeklyStart = subWeeks(now, 11);
  const monthlyStart = subMonths(now, 11);
  const yearlyStart = subYears(now, 3);

  const dailyBuckets = new Map<string, DailyTokensPoint>();
  eachDayOfInterval({ start: dailyStart, end: now }).forEach((day) => {
    const key = format(day, "MMM d");
    dailyBuckets.set(key, { date: key, tokens: 0 });
  });

  const weeklyBuckets = new Map<string, WeeklyReviewsPoint>();
  eachWeekOfInterval({ start: weeklyStart, end: now }, { weekStartsOn: 1 }).forEach(
    (week) => {
      const key = format(week, "MMM d");
      weeklyBuckets.set(key, { week: key, reviews: 0 });
    }
  );

  const monthlyBuckets = new Map<string, MonthlyTokensPoint>();
  eachMonthOfInterval({ start: monthlyStart, end: now }).forEach((month) => {
    const key = format(month, "MMM yyyy");
    monthlyBuckets.set(key, { month: key, inputTokens: 0, outputTokens: 0 });
  });

  const yearlyBuckets = new Map<string, YearlyTokensPoint>();
  eachYearOfInterval({ start: yearlyStart, end: now }).forEach((year) => {
    const key = format(year, "yyyy");
    yearlyBuckets.set(key, { year: key, tokens: 0 });
  });

  let totalTokens = 0;
  let totalReviews = 0;
  let completedReviews = 0;

  reviews.forEach((review) => {
    totalReviews += 1;
    const inputTokens = review.inputTokens || 0;
    const outputTokens = review.outputTokens || 0;
    const tokens = inputTokens + outputTokens;
    totalTokens += tokens;

    if (review.status === "completed") {
      completedReviews += 1;
    }

    const dayKey = format(startOfDay(review.createdAt), "MMM d");
    const dayBucket = dailyBuckets.get(dayKey);
    if (dayBucket) {
      dayBucket.tokens += tokens;
    }

    const weekKey = format(startOfWeek(review.createdAt, { weekStartsOn: 1 }), "MMM d");
    const weekBucket = weeklyBuckets.get(weekKey);
    if (weekBucket) {
      weekBucket.reviews += 1;
    }

    const monthKey = format(startOfMonth(review.createdAt), "MMM yyyy");
    const monthBucket = monthlyBuckets.get(monthKey);
    if (monthBucket) {
      monthBucket.inputTokens += inputTokens;
      monthBucket.outputTokens += outputTokens;
    }

    const yearKey = format(startOfYear(review.createdAt), "yyyy");
    const yearBucket = yearlyBuckets.get(yearKey);
    if (yearBucket) {
      yearBucket.tokens += tokens;
    }
  });

  const summary: AnalyticsSummary = {
    totalReviews,
    totalTokens,
    avgTokensPerReview: totalReviews ? Math.round(totalTokens / totalReviews) : 0,
    successRate: totalReviews ? Math.round((completedReviews / totalReviews) * 100) : 0,
  };

  return {
    isPro: true,
    summary,
    dailyTokens: Array.from(dailyBuckets.values()),
    weeklyReviews: Array.from(weeklyBuckets.values()),
    monthlyTokens: Array.from(monthlyBuckets.values()),
    yearlyTokens: Array.from(yearlyBuckets.values()),
  };
}
