import hmac
import json
import time
from hashlib import sha256

import requests

secret = "Giang123"
payload = {"hello": "world"}
body = json.dumps(payload).encode("utf-8")
ts = str(int(time.time()))
sig = hmac.new(secret.encode("utf-8"), f"{ts}.".encode("utf-8") + body, sha256).hexdigest()

r = requests.post(
    "http://127.0.0.1:8000/inngest/repo-index",
    data=body,
    headers={
        "Content-Type": "application/json",
        "x-cm-timestamp": ts,
        "x-cm-signature": sig,
    },
)

print(r.status_code)
print(r.json())