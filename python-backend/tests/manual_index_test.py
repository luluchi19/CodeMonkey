import json
import os
import time
from hashlib import sha256
import hmac

import requests

secret = os.environ.get("SHARED_SECRET", "")
base_url = os.environ.get("PYTHON_SIDECAR_URL", "http://127.0.0.1:8000")
owner = os.environ.get("OWNER", "")
repo = os.environ.get("REPO", "")
token = os.environ.get("GITHUB_TOKEN", "")
user_id = os.environ.get("USER_ID", "")

missing = [
    name
    for name, value in [
        ("SHARED_SECRET", secret),
        ("OWNER", owner),
        ("REPO", repo),
        ("GITHUB_TOKEN", token),
        ("USER_ID", user_id),
    ]
    if not value
]

if missing:
    raise SystemExit(f"Missing env vars: {', '.join(missing)}")

payload = {
    "owner": owner,
    "repo": repo,
    "token": token,
    "userId": user_id,
}

body = json.dumps(payload, separators=(",", ":")).encode("utf-8")

ts = str(int(time.time()))
sig = hmac.new(secret.encode("utf-8"), f"{ts}.".encode("utf-8") + body, sha256).hexdigest()

resp = requests.post(
    f"{base_url}/inngest/repo-index",
    data=body,
    headers={
        "Content-Type": "application/json",
        "x-cm-timestamp": ts,
        "x-cm-signature": sig,
    },
    timeout=60,
)

print(resp.status_code)
print(resp.text)
