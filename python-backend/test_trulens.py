# test_trulens.py
from lib.trulens_recorder import record_trulens_review

# Gọi function với payload giả
test_payload = {
    "reviewId": "local-test-1",
    "repo": "TonFist/test-python-project",
    "prNumber": 999,
    "title": "Local TruLens metric mapping test",
    "description": "Validate evaluation score mapping",
    "review": "This review includes actionable suggestions and risk analysis.",
    "scores": {
        "groundedness": 4.8,
        "relevance": 5.0,
        "contextRelevance": 4.7,
        "actionability": 4.1,
        "falsePositiveRisk": 1.4,
        "readability": 4.9,
        "brevity": 4.2,
        "coverage": 4.6,
        "honestHelpful": 4.53,
        "model": "models/gemini-2.5-flash-lite",
        "notes": "Synthetic local payload for TruLens metric mapping",
    },
}

success, message = record_trulens_review(test_payload)
print(f"Success: {success}, Message: {message}")