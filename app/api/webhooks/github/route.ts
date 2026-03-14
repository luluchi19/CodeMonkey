import { reviewPullRequest } from "@/module/ai/actions";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = req.headers.get("x-github-event");
    console.log(`Received GitHub webhook event: ${event}`);

    if (event === "ping") {
      return NextResponse.json({ message: "Pong" }, { status: 200 })
    }

    if(event === "pull_request"){
      const action = body.action;
      const repo = body.repository.full_name;
      const prNumber = body.number;
      console.log(`Pull request webhook: action=${action} repo=${repo} pr=${prNumber}`);

      const [owner , repoName]= repo.split("/")

      if(action === "opened" || action === "synchronize"){
        await reviewPullRequest(owner , repoName , prNumber)
        console.log(`Review requested for ${repo} #${prNumber}`)
      }

    }


    // TODO: HANDLE LATER

    return NextResponse.json({ message: "Event Processes" }, { status: 200 })
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
