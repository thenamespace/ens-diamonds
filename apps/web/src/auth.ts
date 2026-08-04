import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createPublicClient, http } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";

import { activeChain } from "@/lib/network";

const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(),
});

export const authConfig = {
  providers: [
    Credentials({
      name: "Ethereum",
      credentials: {
        csrfToken: { label: "CSRF token", type: "hidden" },
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials) {
        try {
          const message = credentials.message;
          const signature = credentials.signature;

          if (typeof message !== "string" || typeof signature !== "string") {
            return null;
          }

          const siweMessage = parseSiweMessage(message);
          const address = siweMessage.address;
          const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
          const csrfToken =
            typeof credentials.csrfToken === "string" ? credentials.csrfToken : undefined;

          if (
            !address ||
            !authUrl ||
            !csrfToken ||
            siweMessage.domain !== new URL(authUrl).host ||
            siweMessage.nonce !== csrfToken ||
            siweMessage.chainId !== activeChain.id ||
            !validateSiweMessage({
              address: siweMessage.address,
              message: siweMessage,
            })
          ) {
            return null;
          }

          const valid = await publicClient.verifyMessage({
            address,
            message,
            signature: signature as `0x${string}`,
          });

          return valid ? { id: address } : null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.address = token.sub;

      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
