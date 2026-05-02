"use client";

import React, { useRef, useState, WheelEvent } from "react";
import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

interface GuideScreenshotCardProps {
  title: string;
  path: string;
  frameClassName?: string;
}

export function GuideScreenshotCard({
  title,
  path,
  frameClassName = "h-40 md:h-44",
}: GuideScreenshotCardProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group block w-full text-left outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
          aria-label={`Open larger preview for ${title}`}
        >
          <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm ring-1 ring-border/40 transition-shadow duration-150 group-hover:shadow-md">
            <div className="flex h-full flex-col gap-3 p-3 md:p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-tight md:text-[15px]">{title}</h3>
                <span className="rounded-full border border-border/70 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
                  Click to enlarge
                </span>
              </div>

              <div
                className={`relative overflow-hidden rounded-2xl border border-border/70 bg-muted/20 shadow-inner ${frameClassName}`}
              >
                <Image
                  src={path}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 100vw, 420px"
                  className="object-contain p-2"
                />
              </div>
            </div>
          </Card>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div
          className="relative h-[60vh] overflow-hidden rounded-2xl border border-border/70 bg-background"
          onWheel={(e: WheelEvent) => {
            // prevent page scroll while zooming
            e.preventDefault();
          }}
        >
          <ZoomableImage src={path} alt={title} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState<number>(1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY;
    const factor = delta > 0 ? 0.9 : 1.1;
    setScale((s) => {
      const next = Math.min(4, Math.max(1, +(s * factor).toFixed(2)));
      return next;
    });
  }

  function onDoubleClick() {
    setScale(1);
  }

  return (
    <div
      ref={wrapperRef}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      className="relative h-full w-full touch-none"
      role="img"
      aria-label={alt}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `scale(${scale})`, transition: "transform 120ms" }}
      >
        <Image src={src} alt={alt} fill sizes="100vw" className="object-contain p-2" />
      </div>
    </div>
  );
}