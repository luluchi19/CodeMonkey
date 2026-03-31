"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getReviews } from "@/module/review/actions"
import { formatDistanceToNow } from "date-fns"
import { Spinner } from "@/components/ui/spinner"
import { useSearchParams } from "next/navigation"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

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

  const searchParams = useSearchParams()
  const focusedReviewId = searchParams.get("reviewId")

  const formatDuration = (start?: string, end?: string) => {
    if (!start) {
      return null
    }

    const startMs = new Date(start).getTime()
    const endMs = end ? new Date(end).getTime() : Date.now()
    const seconds = Math.max(0, Math.round((endMs - startMs) / 1000))
    return `${seconds}s`
  }
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
            {reviews?.map((review: any) => {
              const duration = formatDuration(review.startedAt, review.completedAt)
              const latestEvent = review.events?.[review.events.length - 1]
              const etaMs = latestEvent?.meta?.etaMs

              return (
              <Card
                key={review.id}
                className={`hover:shadow-md transition-shadow ${
                  focusedReviewId === review.id ? "ring-2 ring-primary" : ""
                }`}
              >
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

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {duration && (
                        <span className="rounded-full border px-2 py-1">
                          {review.completedAt ? "Duration" : "Elapsed"}: {duration}
                        </span>
                      )}
                      {typeof etaMs === "number" && etaMs > 0 && review.status === "pending" && (
                        <span className="rounded-full border px-2 py-1">
                          ETA: {Math.max(1, Math.round(etaMs / 1000))}s
                        </span>
                      )}
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="bg-muted p-4 rounded-lg">
                        <pre className="whitespace-pre-wrap text-xs">
                          {review.review.substring(0, 300)}...
                        </pre>
                      </div>
                    </div>

                    <Accordion type="single" collapsible>
                      <AccordionItem value="trace">
                        <AccordionTrigger>Review Timeline</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 text-xs">
                            {review.events?.length ? (
                              review.events.map((event: any) => (
                                <div
                                  key={event.id}
                                  className="flex flex-wrap items-center gap-2 rounded border px-3 py-2"
                                >
                                  <span className="text-muted-foreground">
                                    {new Date(event.createdAt).toLocaleTimeString()}
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {event.message}
                                  </span>
                                  {event.meta?.elapsedMs !== undefined && (
                                    <span className="text-muted-foreground">
                                      {Math.max(1, Math.round(event.meta.elapsedMs / 1000))}s elapsed
                                    </span>
                                  )}
                                  {event.meta?.etaMs !== undefined && event.meta.etaMs > 0 && (
                                    <span className="text-muted-foreground">
                                      ETA {Math.max(1, Math.round(event.meta.etaMs / 1000))}s
                                    </span>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-muted-foreground">No timeline events yet.</div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <Button variant="outline" asChild>
                      <a href={review.prUrl} target="_blank" rel="noopener noreferrer">
                        View Full Review on GitHub
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )})}
          </div>
        )
      }
    </div>
  )
}
