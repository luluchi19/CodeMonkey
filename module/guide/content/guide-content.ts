export const overviewParagraphs = [
  "CodeMonkey is an AI code review agent that checks pull requests with repository-level context instead of guessing from the diff alone.",
  "It combines PR diff analysis, code retrieval, and grounded prompts so the review reads naturally, stays relevant, and fits into a real engineering workflow.",
];

export const howItWorks = [
  {
    step: "1",
    title: "Connects to your repository",
    description:
      "Open **Repositories** in the sidebar, select the repository you want to connect, and click **Connect** in the top-right corner. CodeMonkey will index the code structure before it reviews anything.",
    imageKey: "Repository connect flow",
  },
  {
    step: "2",
    title: "Reviews pull requests automatically",
    description:
      "When a pull request is opened, CodeMonkey reads the diff, retrieves nearby context, and posts findings and suggested fixes directly in the thread.",
    imageKey: "Review output",
  },
  {
    step: "3",
    title: "Supports fast fix workflows",
    description:
      "Each finding is written to be actionable: fix the code, push a new commit, and re-run review with the updated context.",
    imageKey: "Pull request creation",
  },
];

export const gitCommandBlocks = [
  {
    title: "Create a branch",
    code: "git checkout -b feature/your-guide-change",
  },
  {
    title: "Stage your changes",
    code: "git add .",
  },
  {
    title: "Commit",
    code: 'git commit -m "docs: update guide"',
  },
  {
    title: "Push to GitHub",
    code: "git push origin feature/your-guide-change",
  },
];

export const productHighlights = [
  {
    title: "Grounded Findings",
    description:
      "Findings are tied to changed code and retrieved context, reducing vague or generic comments.",
  },
  {
    title: "Clear Prioritization",
    description:
      "Review output separates blockers, important concerns, and optional improvements.",
  },
  {
    title: "Re-review Friendly",
    description:
      "After new commits, CodeMonkey can run again so teams can validate fixes in the same PR cycle.",
  },
];

export const workflowSteps = [
  {
    step: "1",
    title: "Connect your repository",
    description:
      "Go to **Repositories**, choose the GitHub repository you want to track, and click **Connect**. Wait until indexing finishes before moving to the next step.",
    imageKey: "Repository connect flow",
  },
  {
    step: "2",
    title: "Create a branch and push it",
    description:
      "Use the copy blocks below one by one, in order. Each command is intentionally separated so it is easy to copy, verify, and retry if needed.",
  },
  {
    step: "3",
    title: "Open a pull request",
    description:
      "On GitHub, click **Pull requests** → **New pull request** → choose the correct **base** and **compare** branches → click **Create pull request**. The image below shows the exact screen to compare against.",
      imageKey: "Pull request creation",
  },
  {
    step: "4",
    title: "Review the result",
    description:
      "Once the review is posted, open the PR thread and look for the **AI CodeMonkey Review** comment. The image below shows a complete example so you can compare the format, depth, and tone.",
    imageKey: "Review output",
  },
  {
    step: "5",
    title: "Tune the Settings page",
    description:
      "Open **Settings** and adjust **Review language**, **Review sections**, and **Audit mode**. Each reference image below maps to one configuration area.",
  },
];

export const reviewCriteria = [
  {
    title: "Grounded in code",
    description:
      "Every claim should point to the diff or retrieved context. If context is missing, the review should say so instead of guessing.",
  },
  {
    title: "Actionable",
    description:
      "Suggestions should be specific enough to edit the code immediately, with file names, line ranges, or short snippets when useful.",
  },
  {
    title: "Low false positives",
    description:
      "Prefer fewer but correct issues over noisy speculation. That keeps the review trustworthy for real teams.",
  },
  {
    title: "Clear prioritization",
    description:
      "Separate blockers, important concerns, and nice-to-have suggestions so the author knows what to fix first.",
  },
];

export const settingsEffects = [
  {
    key: "reviewLanguage",
    label: "Review language",
    effect:
      "Controls whether the final comment is written in English or Vietnamese.",
  },
  {
    key: "reviewSections",
    label: "Review sections",
    effect:
      "Lets you choose which sections appear in the final review, such as walkthrough, issues, tests, and risk score.",
  },
  {
    key: "reviewAuditEnabled",
    label: "Audit mode",
    effect:
      "Adds a stricter evaluation pass so you can inspect review quality before trusting the output.",
  },
];

export const imageSlots = [
  {
    title: "Repository connect flow",
    path: "/guide/repository-connect.png",
    frameClassName: "h-36 md:h-40",
  },
  {
    title: "Pull request creation",
    path: "/guide/pull-request-create-2.png",
    frameClassName: "h-36 md:h-40",
  },
  {
    title: "Review output",
    path: "/guide/review-result.png",
    frameClassName: "h-44 md:h-52",
  },
  {
    title: "Settings review language",
    path: "/guide/settings-review-1.png",
    frameClassName: "h-36 md:h-40",
  },
  {
    title: "Settings audit mode",
    path: "/guide/settings-review-2.png",
    frameClassName: "h-36 md:h-40",
  },
];