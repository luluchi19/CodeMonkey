import crypto from "crypto";

const RAW_BASE_URL = process.env.PYTHON_SIDECAR_URL;
const SHARED_SECRET = process.env.PYTHON_SIDECAR_SECRET;

function getBaseUrl(): string {
  if (!RAW_BASE_URL) {
    throw new Error("PYTHON_SIDECAR_URL is not set");
  }

  return RAW_BASE_URL.replace(/\/$/, "");
}

function getSecret(): string {
  if (!SHARED_SECRET) {
    throw new Error("PYTHON_SIDECAR_SECRET is not set");
  }

  return SHARED_SECRET;
}

export async function postToPythonSidecar(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  const baseUrl = getBaseUrl();
  const secret = getSecret();
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(body)
    .digest("hex");

  console.log(`Python sidecar POST ${baseUrl}${endpoint}`);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cm-timestamp": timestamp,
      "x-cm-signature": signature,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Python sidecar error ${response.status}: ${text}`);
  }

  try {
    return await response.json();
  } catch {
    return { ok: true };
  }
}
