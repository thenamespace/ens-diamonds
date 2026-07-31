import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    address?: string;
    user: DefaultSession["user"];
  }
}
