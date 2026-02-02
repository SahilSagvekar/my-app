import NextAuth from "next-auth"
import { authOptions } from "./lib/nextauth-options"

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
