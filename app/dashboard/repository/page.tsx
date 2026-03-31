"use client";
import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Star, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRepositories } from "@/module/repository/hooks/use-repositories";
import { RepositoryListSkeleton } from "@/module/repository/components/repository-skeleton";
import { useConnectRepository } from "@/module/repository/hooks/use-connect-repository";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  isConnected?: boolean;
  indexStatus?: string;
  indexMessage?: string | null;
  indexedAt?: string | null;
}

const RepositoryPage = () => {

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useRepositories();

  const {mutate: connectRepo} = useConnectRepository();

  const [localConnectingId, setLocalConnectingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          fetchNextPage();
        }
      },
      {
        threshold: 0.1,
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Repositories
          </h1>
          <p className="text-muted-foreground">
            Manage and view all your GitHub repositories
          </p>
        </div>
        <RepositoryListSkeleton />
      </div>
    );
  }

  if (isError) {
    return <div>Failed to load repositories.</div>;
  }


  const allRepositories = data?.pages.flatMap((page) => page) || [];

  const filteredRepositories = allRepositories.filter(
    (repo: Repository) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const handleConnect = (repo: Repository) => {
    setLocalConnectingId(repo.id);
    connectRepo(
      {
        owner: repo.full_name.split("/")[0],
        repo: repo.name,
        githubId: repo.id
      },
      {
        onSettled:()=>setLocalConnectingId(null)
      }
    )
  }

  const getStatusBadge = (repo: Repository) => {
    if (!repo.isConnected) return null;

    const status = repo.indexStatus || "ready";

    if (status === "indexing") {
      return <Badge variant="outline">Indexing</Badge>;
    }

    if (status === "failed") {
      return <Badge variant="destructive">Index Failed</Badge>;
    }

    if (status === "warning") {
      return <Badge variant="secondary">Connected (warning)</Badge>;
    }

    return <Badge variant="secondary">Connected</Badge>;
  };

  const getConnectLabel = (repo: Repository) => {
    if (localConnectingId === repo.id) {
      return "Connecting...";
    }

    if (!repo.isConnected) {
      return "Connect";
    }

    if (repo.indexStatus === "indexing") {
      return "Indexing...";
    }

    if (repo.indexStatus === "failed") {
      return "Index Failed";
    }

    if (repo.indexStatus === "warning") {
      return "Connected (warning)";
    }

    return "Connected";
  };


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Repositories
        </h1>
        <p className="text-muted-foreground">
          Manage and view all your GitHub repositories
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="grid gap-4 mt-6">
          {filteredRepositories.map((repo: any) => (
            <Card
              key={repo.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {repo.name}
                      </CardTitle>
                      <Badge variant="outline">
                        {repo.language || "Unknown"}
                      </Badge>
                      {getStatusBadge(repo)}
                    </div>
                    <CardDescription>
                      {repo.description}
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>

                    <Button
                      onClick={() => handleConnect(repo)}
                      disabled={
                        localConnectingId === repo.id ||
                        repo.isConnected
                      }
                      variant={
                        repo.isConnected ? "outline" : "default"
                      }
                    >
                      {getConnectLabel(repo)}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      <span className="text-sm font-medium">
                        {repo.stargazers_count}
                      </span>
                    </div>
                  </div>
                  {repo.isConnected && repo.indexMessage && (
                    <p className="text-xs text-muted-foreground">
                      {repo.indexMessage}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div ref={observerTarget} className="py-4">
        {isFetchingNextPage && <RepositoryListSkeleton />}

        {!hasNextPage && allRepositories.length > 0 && (
          <p className="text-center text-muted-foreground">
            No More Repositories
          </p>
        )}
      </div>

    </div>

  );
};

export default RepositoryPage;
