import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";

// Server-only Firebase (route handlers): verifies who is calling and sends
// push messages. The service-account JSON lives in FIREBASE_SERVICE_ACCOUNT
// (Netlify environment / .env.local) — never in the repository.

let cached: App | null | undefined;

export function adminApp(): App | null {
  if (cached !== undefined) return cached;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return (cached = null);
  try {
    const account = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
    cached = getApps().length
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: account.project_id,
            clientEmail: account.client_email,
            // Some dashboards turn the key's newlines into literal "\n".
            privateKey: account.private_key.replace(/\\n/g, "\n"),
          }),
        });
  } catch (error) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON", error instanceof Error ? error.message : "");
    cached = null;
  }
  return cached;
}
