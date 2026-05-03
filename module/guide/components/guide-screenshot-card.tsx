"use client";

import React, { useState, useRef, MouseEvent } from "react";
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
        <div className="relative h-[60vh] overflow-hidden rounded-2xl border border-border/70 bg-background">
          <ZoomableImage src={path} alt={title} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  function onDoubleClick() {
    const container = containerRef.current;
    const content = contentRef.current;
    setScale(1);
    if (content) content.style.transformOrigin = "center";
    if (container) {
      requestAnimationFrame(() => {
        container.scrollLeft = 0;
        container.scrollTop = 0;
      });
    }
  }

  function onClick(e: MouseEvent) {
    e.stopPropagation();
    const container = containerRef.current;
    const content = contentRef.current;
    const rect = container?.getBoundingClientRect();
    const originX = rect ? e.clientX - rect.left : undefined;
    const originY = rect ? e.clientY - rect.top : undefined;

    const prev = scale;
    const next = prev === 1 ? 2.2 : 1;

    if (content && originX !== undefined && originY !== undefined) {
      content.style.transformOrigin = `${originX}px ${originY}px`;
    }

    if (container && originX !== undefined && originY !== undefined) {
      const cx = originX + container.scrollLeft;
      const cy = originY + container.scrollTop;
      const newScrollLeft = Math.max(0, (cx * next) / prev - originX);
      const newScrollTop = Math.max(0, (cy * next) / prev - originY);
      setScale(next);
      requestAnimationFrame(() => {
        container.scrollLeft = newScrollLeft;
        container.scrollTop = newScrollTop;
      });
      return;
    }

    setScale(next);
  }

  // Render a scrollable container; when the inner image is scaled > 1, overflow:auto
  // provides scrollbars for panning horizontally/vertically.
  return (
    <div ref={containerRef} className="h-full w-full overflow-auto" role="img" aria-label={alt}>
      <div
        ref={contentRef}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className="inline-block p-2"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center",
          transition: "transform 120ms",
          cursor: scale === 1 ? "zoom-in" : "zoom-out",
        }}
        title={scale === 1 ? "Click to zoom" : "Click to reset zoom"}
      >
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={800}
          sizes="(max-width: 768px) 100vw, 1200px"
          className="object-contain"
        />
      </div>
    </div>
  );
}