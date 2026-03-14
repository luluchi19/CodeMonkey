import hmac
import time
from hashlib import sha256

from app.config import settings


def verify_signature(payload: bytes, timestamp: str, signature: str) -> bool:
    if not settings.shared_secret:
        return False

    try:
        ts = int(timestamp)
    except ValueError:
        return False

    if abs(int(time.time()) - ts) > 300:
        return False

    msg = f"{timestamp}.".encode("utf-8") + payload
    expected = hmac.new(settings.shared_secret.encode("utf-8"), msg, sha256).hexdigest()
    ok = hmac.compare_digest(expected, signature)

    if not ok and settings.env == "local":
        print("signature_mismatch", {"expected": expected, "received": signature})

    return ok
