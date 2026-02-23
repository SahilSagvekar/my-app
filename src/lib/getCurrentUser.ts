import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";

export async function getCurrentUser() {
  // @ts-ignore - NextAuth v5 typing can be tricky with v4-style getServerSession
  const session = await getServerSession(authOptions);
  return session?.user || null;
}
