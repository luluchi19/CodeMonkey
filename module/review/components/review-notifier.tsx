"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { getReviews } from "@/module/review/actions";

export function ReviewNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const statusMapRef = useRef<Record<string, string>>({});

  const { data: reviews } = useQuery({
    queryKey: ["reviews"],
    queryFn: async () => await getReviews(),
    refetchInterval: (query) => {
      const data = query.state.data as any[] | undefined;
      return data?.some((review) => review.status === "pending") ? 8000 : false;
    },
  });

  useEffect(() => {
    if (!reviews) {
      return;
    }

    const statusMap = statusMapRef.current;

    for (const review of reviews) {
      const previousStatus = statusMap[review.id];
      const isReviewsPage = pathname?.startsWith("/dashboard/reviews");

      const openReview = () => {
        router.push(`/dashboard/reviews?reviewId=${review.id}`);
      };

      if (!previousStatus && review.status === "pending" && !isReviewsPage) {
        toast.info("Review started", {
          description: `${review.repository.fullName} • PR #${review.prNumber}`,
          action: {
            label: "View",
            onClick: openReview,
          },
        });
      }

      if (previousStatus !== review.status) {
        if (review.status === "completed") {
          toast.success("Review completed", {
            description: `${review.repository.fullName} • PR #${review.prNumber}`,
            action: {
              label: "View",
              onClick: openReview,
            },
          });
        }

        if (review.status === "failed") {
          toast.error("Review failed", {
            description: review.review?.substring(0, 120) || "Review failed.",
            action: {
              label: "Details",
              onClick: openReview,
            },
          });
        }
      }

      statusMap[review.id] = review.status;
    }
  }, [reviews, pathname, router]);

  return null;
}
