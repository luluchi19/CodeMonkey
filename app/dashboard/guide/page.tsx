import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    title: "Connect a repository",
    detail:
      "Open the Repository page, pick a repo, and click Connect. Wait for the status to switch to Connected.",
  },
  {
    title: "Open a pull request",
    detail:
      "Create or update a PR in GitHub. CodeMonkey listens for new PR events automatically.",
  },
  {
    title: "Track review progress",
    detail:
      "Visit Reviews to see timelines, ETA, and the final review comment once it posts.",
  },
  {
    title: "Tune your review template",
    detail:
      "Go to Settings and pick which review sections you want included in every PR review.",
  },
  {
    title: "Share results",
    detail:
      "Open the PR comment, apply the suggestions, and re-run when needed.",
  },
];

const tips = [
  "Keep PRs focused for faster analysis and lower token use.",
  "Use the References section to add official docs that the model should cite.",
  "If indexing fails, disconnect and reconnect the repository to retry.",
];

export default function GuidePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-50 via-white to-orange-50 p-8 shadow-sm dark:from-orange-950/40 dark:via-background dark:to-amber-900/40">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-200/50 blur-3xl dark:bg-amber-600/20" />
        <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-orange-200/40 blur-3xl dark:bg-orange-700/20" />

        <div className="relative space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Badge variant="secondary" className="w-fit">
            Quick Start Guide
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">
            Your CodeMonkey Workflow
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            This page walks you through the full CodeMonkey flow, from connecting
            a repository to reviewing the final AI feedback.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Step-by-step</h2>
              <p className="text-sm text-muted-foreground">
                Follow each step in order for the smoothest experience.
              </p>
            </div>
            <ol className="space-y-4">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-xl border bg-card/70 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      {index + 1}
                    </span>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Helpful Tips</h2>
              <p className="text-sm text-muted-foreground">
                Best practices to keep reviews accurate and fast.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {tips.map((tip) => (
                <li key={tip} className="rounded-lg border bg-card/70 p-3">
                  <strong className="text-foreground">Note:</strong> {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
