import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import SlackProvider from "next-auth/providers/slack";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthConfig = {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    trustHost: true,
    debug: true,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },

    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
        }),

        SlackProvider({
            clientId: process.env.SLACK_CLIENT_ID!,
            clientSecret: process.env.SLACK_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
        }),

        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials: any) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }

                const user: any = await prisma.user.findFirst({
                    where: { email: credentials.email },
                });

                if (!user || !user.password) {
                    throw new Error("Invalid credentials");
                }

                const isValid = await bcrypt.compare(credentials.password, user.password as string);
                if (!isValid) {
                    throw new Error("Invalid credentials");
                }

                // ✅ Convert Prisma user to NextAuth-compatible shape
                return {
                    id: user.id.toString(), // NextAuth expects string
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role,
                };
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user, account }: any) {
            console.log("DEBUG [JWT CALLBACK] token:", !!token, "user:", !!user, "account:", account?.provider);

            if (user) {
                // Handle OAuth (Google/Slack) sign-ins manually since we removed the adapter
                if (account?.provider === "google" || account?.provider === "slack") {
                    let dbUser = await prisma.user.findFirst({
                        where: { email: user.email as string },
                    });

                    // If user doesn't exist, create them with no role (pending)
                    if (!dbUser) {
                        dbUser = await prisma.user.create({
                            data: {
                                email: user.email as string,
                                name: user.name,
                                image: user.image,
                                role: null, // Initial state is pending
                            }
                        });
                    }

                    token.id = dbUser.id.toString();
                    token.role = dbUser.role;
                } else {
                    // Credentials login already has correct data from authorize()
                    token.id = user.id;
                    token.role = (user as any).role;
                }
            }
            return token;
        },

        async session({ session, token }: any) {
            console.log("DEBUG [SESSION CALLBACK] token:", !!token, "session:", !!session);
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role;
            }
            return session;
        },
    },

    events: {
        async signIn({ user }: { user: any }) {
            console.log("DEBUG [SIGNIN EVENT] user:", user?.email);
            try {
                const { createAuditLog, AuditAction } = await import('./audit-logger');
                await createAuditLog({
                    userId: parseInt(user.id),
                    action: AuditAction.USER_LOGIN,
                    details: `User logged in: ${user.email}`,
                    metadata: { email: user.email, role: user.role }
                });
            } catch (err) {
                console.error("DEBUG [SIGNIN EVENT ERROR]:", err);
            }
        }
    }
};
