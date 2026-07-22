import { cookies } from "next/headers";

export type SessionUser = {
  id: number;
  username: string;
  name: string;
  role: "ADMIN" | "STAFF";
  permissions: string[];
};

const SESSION_COOKIE = "erp_session";
const encoder = new TextEncoder();

function getSecret() {
  return process.env.AUTH_SECRET || "erp-local-change-this-secret-before-deploy";
}

function base64UrlEncode(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((input.length + 3) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(user: SessionUser) {
  const payload = {
    ...user,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };

  const body = base64UrlEncode(JSON.stringify(payload));

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await signingKey(),
      encoder.encode(body)
    )
  );

  return `${body}.${base64UrlEncode(signature)}`;
}

export async function verifySessionToken(
  token?: string | null
): Promise<(SessionUser & { exp: number }) | null> {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      base64UrlDecode(signature),
      encoder.encode(body)
    );

    if (!valid) {
      return null;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body))
    );

    if (!payload.exp || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || null;
  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    username: session.username,
    name: session.name,
    role: session.role,
    permissions: session.permissions,
  };
}

export async function isAdminSession() {
  const user = await getCurrentSessionUser();
  return user?.role === "ADMIN";
}

export { SESSION_COOKIE };
