import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ReviewDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-28 animate-pulse rounded bg-muted" />

      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="h-6 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-32 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-12 w-full animate-pulse rounded bg-muted" />
            <div className="h-12 w-full animate-pulse rounded bg-muted" />
            <div className="h-12 w-full animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
