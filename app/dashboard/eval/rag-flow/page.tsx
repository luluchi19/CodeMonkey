"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Copy, Download, Play } from "lucide-react";

interface Phase {
  name: string;
  description: string;
  input: Record<string, any>;
  output: Record<string, any>;
  metrics: Record<string, any>;
  duration_ms: number;
}

interface RAGFlowData {
  phases: Phase[];
  summary: {
    total_duration_ms: number;
    phase_count: number;
    timestamp: string;
  };
}

export default function RAGFlowPage() {
  const [repoId, setRepoId] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [prNumber, setPrNumber] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RAGFlowData | null>(null);

  const handleAnalyze = async () => {
    setError(null);
    setLoading(true);
    
    try {
      if (!repoId || !owner || !repo || !prNumber) {
        setError("Vui lòng điền đủ: repo_id, owner, repo, pr_number");
        setLoading(false);
        return;
      }
      
      const params = new URLSearchParams({
        repo_id: repoId,
        owner,
        repo,
        pr_number: prNumber,
      });
      
      const response = await fetch(`/api/eval/rag-flow?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze RAG flow");
      }
      
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadJSON = () => {
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rag-flow-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxDuration = data?.phases.reduce(
    (max, phase) => Math.max(max, phase.duration_ms),
    0
  ) || 0;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto bg-background text-foreground">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          RAG Flow Inspector
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Inspect chi tiết từng bước của RAG pipeline: từ chunking → embedding → retrieval → LLM → evaluation
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Input Parameters</CardTitle>
          <CardDescription className="text-muted-foreground">
            Nhập thông tin repo và PR để analyze
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Repo ID (Database)</label>
              <Input
                placeholder="e.g. abc123"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Owner</label>
              <Input
                placeholder="e.g. torvalds"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Repo</label>
              <Input
                placeholder="e.g. linux"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">PR Number</label>
              <Input
                placeholder="e.g. 42"
                type="number"
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Analysis
                </>
              )}
            </Button>
            
            {data && (
              <>
                <Button
                  variant="outline"
                  onClick={downloadJSON}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download JSON
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => copyToClipboard(JSON.stringify(data, null, 2))}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy JSON
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-border/60 bg-muted/30 text-foreground shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Pipeline Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Duration</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(data.summary.total_duration_ms / 1000).toFixed(2)}s
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Phases</p>
                  <p className="text-2xl font-bold text-foreground">{data.summary.phase_count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm font-mono text-foreground/90">
                    {new Date(data.summary.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Pipeline Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.phases.map((phase, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {phase.name}
                      </p>
                      <Badge variant="secondary" className="shrink-0 w-24 justify-center">
                        {phase.duration_ms.toFixed(0)}ms
                      </Badge>
                    </div>
                    <div className="h-8 overflow-hidden rounded-full bg-muted/70 border border-border/60">
                      <div
                        className="flex h-full items-center rounded-full bg-linear-to-r from-blue-500 to-purple-500 px-3 text-xs font-medium text-white shadow-sm"
                        style={{
                          width: `${Math.max(
                            maxDuration > 0 ? (phase.duration_ms / maxDuration) * 100 : 0,
                            10
                          )}%`,
                        }}
                      >
                        <span className="truncate whitespace-nowrap">{phase.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Phases Details */}
          <Tabs defaultValue="0" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
              {data.phases.map((phase, idx) => (
                <TabsTrigger key={idx} value={String(idx)} className="text-xs">
                  {idx + 1}
                </TabsTrigger>
              ))}
            </TabsList>

            {data.phases.map((phase, idx) => (
              <TabsContent key={idx} value={String(idx)} className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-foreground">{phase.name}</CardTitle>
                        <CardDescription className="mt-2 text-base text-muted-foreground">
                          {phase.description}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {phase.duration_ms.toFixed(1)}ms
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Input */}
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-foreground">Input</h4>
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded bg-muted p-4 text-sm text-foreground">
                        {Object.entries(phase.input).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="font-mono text-muted-foreground">{key}:</span>
                            <span className="font-mono">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Output */}
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-foreground">Output</h4>
                      <div className="max-h-96 space-y-2 overflow-y-auto rounded bg-muted p-4 text-sm text-foreground">
                        {Object.entries(phase.output).map(([key, value]) => {
                          // Special handling for arrays and large objects
                          if (key === "retrieved_chunks" && Array.isArray(value)) {
                            return (
                              <div key={key} className="border-t pt-2 first:border-t-0 first:pt-0">
                                <div className="font-mono font-semibold text-foreground">{key}:</div>
                                <div className="pl-4 mt-1 space-y-2">
                                  {value.map((item, i) => (
                                    <div
                                      key={i}
                                      className="bg-background p-2 rounded border text-xs space-y-1"
                                    >
                                      {Object.entries(item as Record<string, unknown>).map(([itemKey, itemValue]) => {
                                        const tooltip =
                                          itemKey === "similarity_score"
                                            ? (item as Record<string, unknown>).score_tooltip
                                            : itemKey === "metadata_preview"
                                            ? "Metadata preview (repoId, path, chunkIndex)"
                                            : undefined;

                                        return (
                                          <div
                                            key={itemKey}
                                            className="flex justify-between"
                                            title={typeof tooltip === "string" ? tooltip : undefined}
                                          >
                                            <span className="font-mono text-muted-foreground">{itemKey}:</span>
                                            <span className="font-mono text-right flex-1 ml-4">
                                              {typeof itemValue === "object"
                                                ? JSON.stringify(itemValue)
                                                : String(itemValue)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          if (Array.isArray(value) && value.length > 0) {
                            return (
                              <div key={key} className="border-t pt-2 first:border-t-0 first:pt-0">
                                <div className="font-mono font-semibold text-foreground">{key}:</div>
                                <div className="pl-4 mt-1 space-y-2">
                                  {value.map((item, i) => (
                                    <div
                                      key={i}
                                      className="bg-background p-2 rounded border text-xs"
                                    >
                                      {typeof item === "object"
                                        ? JSON.stringify(item, null, 2)
                                        : String(item)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          if (typeof value === "object" && value !== null) {
                            return (
                              <div key={key} className="border-t pt-2 first:border-t-0 first:pt-0">
                                <div className="font-mono font-semibold text-foreground">{key}:</div>
                                <pre className="bg-background p-2 rounded mt-1 text-xs overflow-x-auto">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={key}
                              className="flex justify-between border-t pt-2 first:border-t-0 first:pt-0"
                            >
                              <span className="font-mono text-muted-foreground">{key}:</span>
                              <span className="font-mono text-right flex-1 ml-4">
                                {String(value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-foreground">Metrics</h4>
                      <div className="space-y-1 rounded bg-muted p-4 text-sm text-foreground">
                        {Object.entries(phase.metrics).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="font-mono text-muted-foreground">{key}:</span>
                            <span className="font-mono">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}
