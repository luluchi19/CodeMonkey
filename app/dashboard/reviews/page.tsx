"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getReviews } from "@/module/review/actions"
import { formatDistanceToNow } from "date-fns"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"

export default function ReviewsPage(){
  const {data:reviews , isLoading} = useQuery({
    queryKey:["reviews"],
    queryFn:async ()=>{
      return await getReviews()
    },
    refetchInterval: (query) => {
      const data = query.state.data as any[] | undefined
      return data?.some((review) => review.status === "pending") ? 8000 : false
    }
  });

  const statusMapRef = useRef<Record<string, string>>({})

  useEffect(() => {
    if (!reviews) {
      return
    }

    const statusMap = statusMapRef.current

    for (const review of reviews) {
      const previousStatus = statusMap[review.id]

      if (!previousStatus) {
        if (review.status === "pending") {
          toast.info("Review started", {
            description: `${review.repository.fullName} • PR #${review.prNumber}`,
          })
        }

        if (review.status === "completed") {
          toast.success("Review completed", {
            description: `${review.repository.fullName} • PR #${review.prNumber}`,
          })
        }

        if (review.status === "failed") {
          toast.error("Review failed", {
            description: review.review?.substring(0, 120) || "Review failed.",
          })
        }
      } else if (previousStatus !== review.status) {
        if (review.status === "completed") {
          toast.success("Review completed", {
            description: `${review.repository.fullName} • PR #${review.prNumber}`,
          })
        }

        if (review.status === "failed") {
          toast.error("Review failed", {
            description: review.review?.substring(0, 120) || "Review failed.",
          })
        }
      }

      statusMap[review.id] = review.status
    }
  }, [reviews])
  if(isLoading){
    return (
      <div className="flex items-center justify-center min-h-[240px]">
        <Spinner />
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review History</h1>
        <p className="text-muted-foreground">View all AI code reviews</p>
      </div>

      {
        reviews?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No reviews yet. Connect a repository and open a PR to get started.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reviews?.map((review: any) => (
              <Card key={review.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{review.prTitle}</CardTitle>

                        {review.status === "completed" && (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </Badge>
                        )}

                        {review.status === "failed" && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        )}

                        {review.status === "pending" && (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            In progress
                          </Badge>
                        )}
                      </div>

                      <CardDescription>
                        {review.repository.fullName} • PR #{review.prNumber}
                      </CardDescription>
                    </div>

                    <Button variant="ghost" size="icon" asChild>
                      <a href={review.prUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="bg-muted p-4 rounded-lg">
                        <pre className="whitespace-pre-wrap text-xs">
                          {review.review.substring(0, 300)}...
                        </pre>
                      </div>
                    </div>

                    <Button variant="outline" asChild>
                      <a href={review.prUrl} target="_blank" rel="noopener noreferrer">
                        View Full Review on GitHub
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  )
}
