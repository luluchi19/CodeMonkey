"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, updateUserProfile } from "@/module/settings/actions";
import { toast } from "sonner";

export function ReviewAuditToggle() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => await getUserProfile(),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (typeof profile?.reviewAuditEnabled === "boolean") {
      setEnabled(profile.reviewAuditEnabled);
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (nextValue: boolean) =>
      updateUserProfile({ reviewAuditEnabled: nextValue }),
    onMutate: async (nextValue) => {
      const previous = enabled;
      setEnabled(nextValue);
      return { previous };
    },
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        setEnabled(Boolean(result.user?.reviewAuditEnabled));
        toast.success("Review audit setting updated");
      } else {
        toast.error(result?.error || "Failed to update review audit setting");
      }
    },
    onError: (_error, _value, context) => {
      setEnabled(context?.previous ?? false);
      toast.error("Failed to update review audit setting");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });

  const isPro = profile?.subscriptionTier?.toUpperCase() === "PRO";
  const isDisabled = !isPro || updateMutation.isPending;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-52 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-6 w-12 animate-pulse rounded-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300/60 bg-[linear-gradient(120deg,rgba(255,237,213,0.55),rgba(255,255,255,0.8))]">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Review Quality Audit</CardTitle>
          <Badge variant="secondary">PRO</Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
                A second LLM pass polishes the review and removes vague claims.
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
            Let a second LLM refine the AI review before it is posted.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isPro ? "Enable quality audit" : "Upgrade to PRO to unlock"}
          </p>
          <p className="text-xs text-muted-foreground">
            Runs only when enabled. Keeps the final output as a single review.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(value) => {
            updateMutation.mutate(value);
          }}
          disabled={isDisabled || isLoading}
        />
      </CardContent>
    </Card>
  );
}
