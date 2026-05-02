import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyableCodeBlock } from "@/module/guide/components/copyable-code-block";
import { GuideScreenshotCard } from "@/module/guide/components/guide-screenshot-card";
import {
  gitCommandBlocks,
  imageSlots,
  overviewParagraphs,
  productHighlights,
  reviewCriteria,
  settingsEffects,
  workflowSteps,
} from "@/module/guide/content/guide-content";

function renderRichText(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export default function GuidePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-amber-100 via-white to-orange-100 p-8 shadow-sm dark:from-amber-950/35 dark:via-zinc-950 dark:to-orange-950/30">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-300/40 blur-3xl dark:bg-amber-600/20" />
        <div className="absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-700/20" />

        <div className="relative max-w-3xl space-y-4">
          <Badge variant="secondary" className="w-fit">
            Guide
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Overview - how CodeMonkey works
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            A practical, step-by-step guide for connecting a repository, opening a pull request,
            reading the review output, and tuning the settings that shape review quality.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Overview
            </Badge>
            <CardTitle className="text-2xl">How it works at a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overviewParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7 text-muted-foreground sm:text-base">
                {paragraph}
              </p>
            ))}

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-5">
              <p className="text-sm font-semibold text-foreground">Quick path</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Connect the repository, open the pull request, review the findings, and then fine-tune
                the settings. The sections below show exactly where to click and what to copy.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Workflow
            </Badge>
            <CardTitle className="text-2xl">From branch to reviewed PR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {workflowSteps.map((step) => {
              const imageSlot = step.imageKey
                ? imageSlots.find((slot) => slot.title === step.imageKey)
                : null;

              return (
                <div
                  key={step.step}
                  className="rounded-2xl border border-border/70 bg-background/40 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                      {step.step}
                    </div>
                    <div className="min-w-0 space-y-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {renderRichText(step.description)}
                        </p>
                      </div>

                      {step.step === "2" ? (
                        <div className="space-y-3 pt-1">
                          <p className="text-sm font-semibold text-foreground">
                            Copy each block below in the exact order shown.
                          </p>
                          {gitCommandBlocks.map((item) => (
                            <CopyableCodeBlock
                              key={item.title}
                              title={item.title}
                              description="Each block contains one command only, which keeps the flow easy to copy and verify."
                              code={item.code}
                            />
                          ))}
                        </div>
                      ) : null}

                      {imageSlot ? (
                        <div className="pt-1">
                          <GuideScreenshotCard {...imageSlot} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Settings
            </Badge>
            <CardTitle className="text-2xl">How settings shape output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settingsEffects.map((item) => (
              <Card key={item.key} className="border-border/70 bg-muted/20 p-4 shadow-sm">
                <p className="text-sm font-semibold tracking-tight">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.effect}</p>
              </Card>
            ))}

            <div className="space-y-4 pt-1">
              {imageSlots
                .filter(
                  (slot) =>
                    slot.title === "Settings review language" || slot.title === "Settings audit mode",
                )
                .map((slot) => (
                  <GuideScreenshotCard key={slot.title} {...slot} />
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Review Quality
            </Badge>
            <CardTitle className="text-2xl">What strong reviews include</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewCriteria.map((criterion) => (
              <Card key={criterion.title} className="border-border/70 bg-muted/20 p-4 shadow-sm">
                <p className="text-sm font-semibold tracking-tight">{criterion.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {criterion.description}
                </p>
              </Card>
            ))}
            <p className="pt-1 text-sm leading-6 text-muted-foreground">
              Reference style is similar to Greptile/Qodo: concise comments, grounded evidence,
              and clear next actions for the author.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Product Value
            </Badge>
            <CardTitle className="text-2xl">Why teams use CodeMonkey</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {productHighlights.map((item) => (
              <Card key={item.title} className="border-border/70 bg-muted/20 p-4 shadow-sm">
                <p className="text-sm font-semibold tracking-tight">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </Card>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
