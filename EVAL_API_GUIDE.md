# CodeMonkey Evaluation APIs - Testing Guide

## 📊 1. GET `/api/reviews/eval-report` - Export Evaluation Metrics

### Endpoint Details
- **Method**: GET
- **Auth**: Required (Bearer token)
- **Purpose**: Retrieve evaluation scores & summary statistics for all reviews

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `json` | `json` or `csv` |
| `includeLegend` | boolean | `1` | Include metric definitions (0 or 1) |
| `limit` | number | `200` | Max records (1-1000) |

### cURL Test Examples

#### Test 1: JSON format with legend
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/reviews/eval-report?format=json&includeLegend=1&limit=50"
```

#### Test 2: CSV format (download)
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/reviews/eval-report?format=csv&includeLegend=1" \
  -o eval-report.csv
```

#### Test 3: Without legend (smaller response)
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/reviews/eval-report?format=json&includeLegend=0"
```

### Response (JSON Format)

```json
{
  "summary": {
    "total": 45,
    "groundednessAvg": 4.12,
    "relevanceAvg": 4.35,
    "contextRelevanceAvg": 3.68,
    "actionabilityAvg": 3.92,
    "falsePositiveRiskAvg": 1.85,
    "coverageAvg": 3.78,
    "honestHelpfulAvg": 3.95
  },
  "rows": [
    {
      "reviewId": "review-abc123",
      "repo": "owner/repo",
      "prNumber": 142,
      "createdAt": "2025-02-15T09:32:00Z",
      "groundedness": 4.5,
      "relevance": 4.8,
      "contextRelevance": 3.2,
      "actionability": 4.1,
      "falsePositiveRisk": 1.8,
      "readability": 4.3,
      "brevity": 3.9,
      "coverage": 4.0,
      "honestHelpful": 4.0,
      "model": "models/gemini-2.5-flash-lite",
      "notes": "Solid review covering main refactor risks"
    },
    ...
  ],
  "legend": [
    {
      "metric": "groundedness",
      "definition": "Claims are supported by diff/context. / Các nhận định phải có bằng chứng từ diff/ngữ cảnh.",
      "goodThreshold": ">= 4.0",
      "source": "LAURA (truthfulness/M-Score motivation)"
    },
    ...
  ]
}
```

### Response (CSV Format)

```csv
reviewId,repo,prNumber,createdAt,groundedness,relevance,contextRelevance,actionability,falsePositiveRisk,readability,brevity,coverage,honestHelpful,codeChurnRatio,filesChanged,reviewCoverage,suggestionDensity,model,notes
review-abc123,owner/repo,142,2025-02-15T09:32:00Z,4.5,4.8,3.2,4.1,1.8,4.3,3.9,4.0,4.0,0.31,12,0.42,1.85,models/gemini-2.5-flash-lite,"Solid review covering main refactor risks"
review-def456,owner/repo,141,2025-02-15T08:15:00Z,4.1,4.5,3.5,3.9,2.1,4.0,3.8,3.7,3.85,0.22,8,0.35,1.5,models/gemini-2.5-flash-lite,"Good coverage of edge cases"

metric,definition,range,goodThreshold,source
groundedness,"Claims are supported by diff/context.","0-5",">= 4.0","LAURA (truthfulness/M-Score motivation)"
relevance,"Comments focus on this PR and changed code.","0-5",">= 4.0","LAURA/RARe"
contextRelevance,"Retrieved context is useful for this PR.","0-5",">= 3.5","RAG best practices"
actionability,"Suggestions are concrete and feasible.","0-5",">= 3.5","LAURA (Operability)"
falsePositiveRisk,"Higher means more misleading/incorrect claims.","0-5","<= 2.0","LAURA (M-Score)"
readability,"Clear, easy-to-read language.","0-5",">= 3.5","LAURA (Readability)"
brevity,"Concise without losing key points.","0-5",">= 3.0","LAURA (Brevity)"
coverage,"Covers important issues likely present.","0-5",">= 3.5","LAURA (Sufficiency)"
honestHelpful,"Composite: truthfulness + relevance + actionability.","0-5",">= 3.5","Derived (project rubric)"
codeChurnRatio,"(additions + deletions) / estimated_total_lines. PR size complexity.","0-1","<= 0.3","GitHub PR metadata"
reviewCoverage,"Estimated % of changed lines mentioned in review.","0-1",">= 0.3","Computed from diff vs review text"
suggestionDensity,"Number of suggestions per PR size (normalized).","0-5+",">= 0.5","Review text analysis"
filesChanged,"Raw count of files modified in this PR.","0-1000+","Info only","GitHub PR metadata"
```

**Note**: CSV now includes UTF-8 BOM for proper Vietnamese character encoding in Excel


---

## 🔄 2. POST `/api/reviews/ingest` - Ingest Review from Python Backend

### Endpoint Details
- **Method**: POST
- **Auth**: Required (HMAC-SHA256 signature)
- **Purpose**: Receive completed review from Python Modal backend
- **Called By**: Python backend after review generation + evaluation

### Headers Required
```
x-cm-timestamp: <unix-timestamp>
x-cm-signature: <hmac-sha256-signature>
Content-Type: application/json
```

### Request Body

```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "prNumber": 142,
  "prTitle": "Refactor authentication flow",
  "prUrl": "https://github.com/myorg/myrepo/pull/142",
  "prAuthor": "dev-user",
  "prState": "open",
  "prCreatedAt": "2025-02-15T08:00:00Z",
  "prMergedAt": null,
  "baseRef": "main",
  "headRef": "feat/auth-refactor",
  "additions": 320,
  "deletions": 145,
  "changedFiles": 12,
  "review": "## Review\n\n### Strengths...",
  "inputTokens": 5000,
  "outputTokens": 2500,
  "estimatedCost": 0.045,
  "status": "completed",
  "reviewId": "review-abc123"
}
```

### Response

```json
{
  "success": true,
  "reviewId": "review-abc123",
  "stored": true
}
```

### How to Trigger
- **Automatic**: Python backend calls this after review + evaluation complete
- **Manual**: For testing, send POST with HMAC signature:

```bash
# Generate signature (Python example)
import hmac
import hashlib
import json
import time

SECRET = "your-PYTHON_SIDECAR_SECRET-from-.env"
payload = {
  "owner": "myorg",
  "repo": "myrepo",
  "prNumber": 142,
  "review": "Test review...",
  ...
}

timestamp = str(int(time.time()))
body_str = json.dumps(payload)
signature = hmac.new(
  SECRET.encode(),
  f"{timestamp}.{body_str}".encode(),
  hashlib.sha256
).hexdigest()

# cURL request
curl -X POST http://localhost:3000/api/reviews/ingest \
  -H "Content-Type: application/json" \
  -H "x-cm-timestamp: $timestamp" \
  -H "x-cm-signature: $signature" \
  -d '$body_str'
```

---

## 📝 3. POST `/api/reviews/logs` - Store Review Logs/Metadata

### Endpoint Details
- **Method**: POST
- **Auth**: Required (HMAC-SHA256 signature)
- **Purpose**: Store additional logs/events from Python backend during review processing

### Request Body

```json
{
  "reviewId": "review-abc123",
  "owner": "myorg",
  "repo": "myrepo",
  "prNumber": 142,
  "event": "context_retrieved",
  "data": {
    "contextCount": 8,
    "retrievalTime": 1250,
    "topScores": [0.92, 0.88, 0.85]
  },
  "timestamp": "2025-02-15T09:30:00Z"
}
```

### Response

```json
{
  "success": true,
  "stored": true
}
```

---

## 🚀 4. GitHub Webhook: POST `/api/webhooks/github`

### Endpoint Details
- **Method**: POST
- **Auth**: Required (GitHub signature verification)
- **Purpose**: Receive PR open/synchronize events from GitHub
- **Triggers**: Review generation pipeline via Inngest

### GitHub Webhook Setup
1. **URL**: `https://yourdomain.com/api/webhooks/github`
2. **Events**: `pull_request` (types: opened, synchronize)
3. **Secret**: Set `GITHUB_WEBHOOK_SECRET` in `.env`
4. **Content Type**: `application/json`

### Sample Payload Received

```json
{
  "action": "opened",
  "pull_request": {
    "number": 142,
    "title": "Refactor auth flow",
    "state": "open",
    "user": {
      "login": "dev-user"
    },
    "head": {
      "ref": "feat/auth-refactor",
      "sha": "abc123def456..."
    },
    "base": {
      "ref": "main"
    },
    "additions": 320,
    "deletions": 145,
    "changed_files": 12,
    "created_at": "2025-02-15T08:00:00Z",
    "html_url": "https://github.com/myorg/myrepo/pull/142"
  },
  "repository": {
    "name": "myrepo",
    "owner": {
      "login": "myorg"
    },
    "full_name": "myorg/myrepo"
  }
}
```

### Automatic Flow
1. GitHub sends webhook → `/api/webhooks/github`
2. Signature verified
3. Inngest enqueues review function → Python backend
4. Python backend fetches PR diff, context, generates review
5. Review evaluation computed (including new metadata metrics)
6. Results posted back via `/api/reviews/ingest`
7. Placeholder comment posted on PR

---

## 📊 Testing Workflow

### Step 1: Check Evaluation Metrics
```bash
# Get latest 10 evaluations
curl -H "Authorization: Bearer $JWT" \
  "http://localhost:3000/api/reviews/eval-report?limit=10"
```

### Step 2: Export CSV for Analysis
```bash
# Download CSV with legend
curl -H "Authorization: Bearer $JWT" \
  "http://localhost:3000/api/reviews/eval-report?format=csv&includeLegend=1" \
  > eval-report.csv

# Open in Excel/Sheets and review metrics
```

### Step 3: Check Averages
Response includes `summary` with averages:
```json
{
  "summary": {
    "groundednessAvg": 4.12,
    "relevanceAvg": 4.35,
    "contextRelevanceAvg": 3.68,
    "falsePositiveRiskAvg": 1.85  // Lower is better
  }
}
```

### Step 4: Trigger Fresh PR Review
```bash
# Create new PR on test repo
git checkout -b test-feature
echo "test change" > test.txt
git add test.txt
git commit -m "Test PR for evaluation"
git push origin test-feature

# Open PR on GitHub → triggers webhook → review generated → metrics computed

# Then check new evaluation:
curl -H "Authorization: Bearer $JWT" \
  "http://localhost:3000/api/reviews/eval-report?limit=1"
```

---

## 🔍 Key Metrics to Check

### LLM-Scored (should be high)
- groundedness ≥ 4.0
- relevance ≥ 4.0
- actionability ≥ 3.5
- coverage ≥ 3.5

### LLM-Scored (should be low)
- falsePositiveRisk ≤ 2.0

### Metadata (informational)
- codeChurnRatio: 0-1 (lower = smaller PR)
- filesChanged: raw count
- reviewCoverage: 0-1 (higher = more comprehensive)
- suggestionDensity: normalized per 10 lines

---

## 🛠️ Debug Checklist

### If evaluation not returning:
1. Check Python backend logs: `tail -f python-backend/logs/review_pipeline.log`
2. Verify `PYTHON_SIDECAR_SECRET` matches in `.env`
3. Check `/api/reviews/logs` for processing events
4. Verify Inngest is running: `inngest dev`

### If metrics missing:
1. Check `evaluation_enabled: true` in `python-backend/app/config.py`
2. Verify `review_evaluator.py` has new parameters
3. Check `review_pipeline.py` passes PR metadata to evaluator
4. Inspect evaluation_metrics dict in logs

### If CSV columns missing:
1. Verify `toCsv()` header includes all 13 columns
2. Check `EvalScores` type has optional metadata fields
3. Verify `parseScores()` extracts all fields

---

## 📌 Environment Variables Needed

### Node/.env
```
PYTHON_SIDECAR_SECRET=your-secret-key
GITHUB_WEBHOOK_SECRET=github-secret
```

### python-backend/.env
```
PYTHON_SIDECAR_SECRET=your-secret-key
EVALUATION_ENABLED=true
EVALUATION_MODEL=models/gemini-2.5-flash-lite
EVALUATION_USE_TRULENS=false
```

---

## Quick Test Script

```bash
#!/bin/bash
# test-eval-api.sh

TOKEN=$1  # Pass JWT as arg: ./test-eval-api.sh "your_jwt_token"

if [ -z "$TOKEN" ]; then
  echo "Usage: ./test-eval-api.sh <JWT_TOKEN>"
  exit 1
fi

echo "=== Testing eval-report API ==="

echo -e "\n1. JSON format with legend:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/reviews/eval-report?format=json&limit=5" | jq '.summary'

echo -e "\n2. CSV format (first 2 rows):"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/reviews/eval-report?format=csv&limit=2" | head -3

echo -e "\n3. Metric legend:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/reviews/eval-report?format=json" | jq '.legend[0:3]'

echo -e "\nDone!"
```

Run:
```bash
chmod +x test-eval-api.sh
./test-eval-api.sh "your-jwt-token"
```
