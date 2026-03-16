"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, updateUserProfile } from "@/module/settings/actions";
import { toast } from "sonner";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "vi", label: "Vietnamese" },
];

export function ReviewLanguageForm() {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState("en");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => await getUserProfile(),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (profile?.reviewLanguage) {
      setLanguage(profile.reviewLanguage);
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (reviewLanguage: string) =>
      updateUserProfile({ reviewLanguage }),
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        toast.success("Review language updated");
      } else {
        toast.error(result?.error || "Failed to update review language");
      }
    },
    onError: () => toast.error("Failed to update review language"),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Language</CardTitle>
          <CardDescription>Choose the output language for AI reviews</CardDescription>
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
        <CardTitle>Review Language</CardTitle>
        <CardDescription>Choose the output language for AI reviews</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger>
            <SelectValue placeholder="Select a language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={() => updateMutation.mutate(language)}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save Language"}
        </Button>
      </CardContent>
    </Card>
  );
}
