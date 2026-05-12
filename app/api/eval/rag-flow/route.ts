import { NextRequest, NextResponse } from "next/server";
import { postToPythonSidecar } from "@/lib/python-sidecar";

/**
 * GET /api/eval/rag-flow
 * Công khai endpoint để inspect RAG pipeline flow
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const repoId = searchParams.get("repo_id");
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const prNumber = searchParams.get("pr_number");
    const fileFilter = searchParams.getAll("file_filter");
    
    if (!repoId || !owner || !repo || !prNumber) {
      return NextResponse.json(
        {
          error: "Missing required query parameters: repo_id, owner, repo, pr_number",
        },
        { status: 400 }
      );
    }
    
    // Call Python backend
    const payload = {
      repo_id: repoId,
      owner,
      repo,
      pr_number: parseInt(prNumber),
      file_filter: fileFilter.length > 0 ? fileFilter : undefined,
    };
    
    const result = await postToPythonSidecar("/eval/rag-flow", payload);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ RAG flow evaluation failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      {
        error: "Failed to evaluate RAG flow",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
