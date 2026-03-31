"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, updateUserProfile } from "@/module/settings/actions";
import { toast } from "sonner";

const SECTION_OPTIONS = [
  {
    key: "walkthrough",
    label: "Walkthrough",
    description: "File-by-file explanation of intent and impact",
    minTokens: 250,
    maxTokens: 500,
  },
  {
    key: "sequence_diagram",
    label: "Sequence Diagram",
    description: "Mermaid diagram when flow changes apply",
    minTokens: 120,
    maxTokens: 260,
  },
  {
    key: "summary",
    label: "Summary",
    description: "3-6 bullet overview",
    minTokens: 90,
    maxTokens: 180,
  },
  {
    key: "strengths",
    label: "Strengths",
    description: "What the PR does well",
    minTokens: 80,
    maxTokens: 160,
  },
  {
    key: "issues",
    label: "Issues",
    description: "Bugs, risks, or smells with severity",
    minTokens: 180,
    maxTokens: 380,
  },
  {
    key: "suggestions",
    label: "Suggestions",
    description: "Concrete improvements with examples",
    minTokens: 180,
    maxTokens: 400,
  },
  {
    key: "tests",
    label: "Tests & Verification",
    description: "What to run or watch",
    minTokens: 60,
    maxTokens: 140,
  },
  {
    key: "references",
    label: "References",
    description: "Link out to relevant docs",
    minTokens: 40,
    maxTokens: 90,
  },
  {
    key: "risk_score",
    label: "Risk Score",
    description: "0-5 with a short rationale",
    minTokens: 40,
    maxTokens: 90,
  },
  {
    key: "poem",
    label: "Poem",
    description: "Short creative summary",
    minTokens: 30,
    maxTokens: 60,
  },
];

const DEFAULT_SECTION_KEYS = SECTION_OPTIONS.map((section) => section.key);

export function ReviewSectionsForm() {
  const queryClient = useQueryClient();
  const [selectedSections, setSelectedSections] = useState<string[]>(
    DEFAULT_SECTION_KEYS
  );

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => await getUserProfile(),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (Array.isArray(profile?.reviewSections) && profile.reviewSections.length > 0) {
      setSelectedSections(profile.reviewSections as string[]);
    }
  }, [profile]);

  const totals = useMemo(() => {
    const selected = new Set(selectedSections);
    return SECTION_OPTIONS.reduce(
      (acc, section) => {
        if (!selected.has(section.key)) return acc;
        return {
          minTokens: acc.minTokens + section.minTokens,
          maxTokens: acc.maxTokens + section.maxTokens,
        };
      },
      { minTokens: 0, maxTokens: 0 }
    );
  }, [selectedSections]);

  const updateMutation = useMutation({
    mutationFn: async (reviewSections: string[]) =>
      updateUserProfile({ reviewSections }),
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        toast.success("Review template updated");
      } else {
        toast.error(result?.error || "Failed to update review template");
      }
    },
    onError: () => toast.error("Failed to update review template"),
  });

  const toggleSection = (key: string) => {
    setSelectedSections((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Template</CardTitle>
          <CardDescription>
            Choose which sections appear in AI reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-10 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Template</CardTitle>
        <CardDescription>
          Choose which sections appear in AI reviews
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Estimated output tokens
          </span>
          <Badge variant="secondary">
            {totals.minTokens}-{totals.maxTokens} tokens
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {SECTION_OPTIONS.map((section) => {
            const checked = selectedSections.includes(section.key);
            return (
              <label
                key={section.key}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  checked
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <Checkbox
                  id={`section-${section.key}`}
                  checked={checked}
                  onCheckedChange={() => toggleSection(section.key)}
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label
                      htmlFor={`section-${section.key}`}
                      className="text-sm font-semibold"
                    >
                      {section.label}
                    </Label>
                    <Badge variant="outline">
                      {section.minTokens}-{section.maxTokens} tokens
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <Button
          onClick={() => updateMutation.mutate(selectedSections)}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save Template"}
        </Button>
      </CardContent>
    </Card>
  );
}
