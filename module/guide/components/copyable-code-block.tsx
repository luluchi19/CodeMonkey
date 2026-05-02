"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CopyableCodeBlockProps {
  code: string;
  title?: string;
  description?: string;
}

export function CopyableCodeBlock({
  code,
  title,
  description,
}: CopyableCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" onClick={handleCopy} aria-label="Copy code">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-sm leading-6 text-foreground">
        <code className="whitespace-pre">{code}</code>
      </pre>
    </Card>
  );
}