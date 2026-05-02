import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Github } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-50 via-background to-orange-100 p-8">
        <div className="absolute -top-14 right-8 h-40 w-40 rounded-full bg-amber-200/60 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-orange-200/60 blur-3xl" />
        <div className="relative space-y-3">
          <Badge variant="secondary" className="w-fit">Say Hello</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Contact the Builder</h1>
          <p className="text-muted-foreground max-w-2xl">
            Friendly channels only. Leave a note, share ideas, or just send a meme.
          </p>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="group border-amber-200/70 bg-card/80 transition-all hover:-translate-y-1 hover:shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 group-hover:rotate-6 transition">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Email</CardTitle>
                <CardDescription>Primary inbox for collabs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <a
              className="text-sm font-semibold text-amber-700 hover:text-amber-600"
              href="mailto:giangnguyeen1910@gmail.com"
            >
              giangnguyeen1910@gmail.com
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Response time depends on coffee supply.
            </p>
          </CardContent>
        </Card>

        <Card className="group border-slate-200/70 bg-card/80 transition-all hover:-translate-y-1 hover:shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:-rotate-6 transition">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>GitHub</CardTitle>
                <CardDescription>Ship code, share stars</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <a
              className="text-sm font-semibold text-slate-500 hover:text-slate-400"
              href="https://github.com/luluchi19"
              target="_blank"
              rel="noreferrer"
            >
              github.com/luluchi19
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Issues, PRs, and pixel-perfect memes welcome.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
