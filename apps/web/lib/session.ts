import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  address?: string; // lowercased, set after SIWE verify
  nonce?: string; // single-use SIWE challenge
};

export const sessionOptions: SessionOptions = {
  // iron-session requires a >= 32 char password; set SESSION_SECRET in env.
  password: process.env.SESSION_SECRET ?? "",
  cookieName: "coffer_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

// Next.js 15: cookies() is async.
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
