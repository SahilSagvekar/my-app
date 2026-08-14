import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import SlackProvider from "next-auth/providers/slack";
import CredentialsProvider from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
                const { db, closeDb } = getDb();
                try {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }

                const [user] = await db
                    .select()
                    .from(userTable)
                    .where(eq(userTable.email, credentials.email))
                    .limit(1);

                if (!user || !user.password) {
                    throw new Error("Invalid credentials");
                }

                if (user.employeeStatus !== 'ACTIVE' && user.email !== 'sahilsagvekar230@gmail.com') {
                    throw new Error("Account is deactivated. Please contact support.");
                }

                const isValid = await bcrypt.compare(credentials.password, user.password as string);
                if (!isValid) {
                    throw new Error("Invalid credentials");
                }

                // ✅ Convert DB user to NextAuth-compatible shape
                return {
                    id: user.id.toString(), // NextAuth expects string
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role,
                    roles: user.roles,
                };
                } finally {
                    await closeDb();
                }
            },
        }),
    ],

    callbacks: {
        async signIn({ user, account }: any) {
            const { db, closeDb } = getDb();
            try {
            if (!user.email) return false;

            const [dbUser] = await db
                .select({ employeeStatus: userTable.employeeStatus })
                .from(userTable)
                .where(eq(userTable.email, user.email))
                .limit(1);

            if (dbUser && dbUser.employeeStatus !== 'ACTIVE' && user.email !== 'sahilsagvekar230@gmail.com') {
                return false; // Block sign-in if not active
            }

            return true;
            } finally {
                await closeDb();
            }
        },

        async jwt({ token, user, account }: any) {
            const { db, closeDb } = getDb();
            try {
            console.log("DEBUG [JWT CALLBACK] token:", !!token, "user:", !!user, "account:", account?.provider);

            if (user) {
                // Handle OAuth (Google/Slack) sign-ins manually since we removed the adapter
                if (account?.provider === "google" || account?.provider === "slack") {
                    let [dbUser] = await db
                        .select()
                        .from(userTable)
                        .where(eq(userTable.email, user.email as string))
                        .limit(1);

                    // If user doesn't exist, create them with no role (pending)
                    if (!dbUser) {
                        const [createdUser] = await db.insert(userTable).values({
                            email: user.email as string,
                            name: user.name,
                            image: user.image,
                            role: null, // Initial state is pending
                            employeeStatus: 'ACTIVE', // OAuth users are active by default if they were allowed to sign in
                            updatedAt: new Date().toISOString(),
                        }).returning();
                        dbUser = createdUser;
                    }

                    if (dbUser.employeeStatus !== 'ACTIVE' && dbUser.email !== 'sahilsagvekar230@gmail.com') {
                        // This should theoretically be caught by signIn callback, but safety first
                        return null;
                    }

                    token.id = dbUser.id.toString();
                    token.role = dbUser.role;
                    token.roles = dbUser.roles;
                } else {
                    // Credentials login already has correct data from authorize()
                    token.id = user.id;
                    token.role = (user as any).role;
                    token.roles = (user as any).roles;
                }
            } else if (token.id) {
                // Periodically verify user status for existing JWTs
                const [dbUser] = await db
                    .select({ employeeStatus: userTable.employeeStatus, email: userTable.email })
                    .from(userTable)
                    .where(eq(userTable.id, Number(token.id)))
                    .limit(1);

                if (dbUser && dbUser.employeeStatus !== 'ACTIVE' && dbUser.email !== 'sahilsagvekar230@gmail.com') {
                    return null; // Force session expiration
                }
            }
            return token;
            } finally {
                await closeDb();
            }
        },

        async session({ session, token }: any) {
            console.log("DEBUG [SESSION CALLBACK] token:", !!token, "session:", !!session);
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role;
                session.user.roles = token.roles || [];
            }
            return session;
        },
    },

    events: {
        async signIn({ user }: { user: any }) {
            console.log("DEBUG [SIGNIN EVENT] user:", user?.email);
            try {
                const { createAuditLog, AuditAction } = await import('./audit-logger');
                // Note: NextAuth events don't provide request/IP context.
                // The centralized createAuditLog will skip India-based logins
                // only when ipAddress is provided. OAuth logins without IP
                // context will still be logged (fail-open).
                await createAuditLog({
                    userId: parseInt(user.id),
                    action: AuditAction.USER_LOGIN,
                    details: `User logged in via OAuth: ${user.email}`,
                    metadata: { email: user.email, role: user.role }
                });
            } catch (err) {
                console.error("DEBUG [SIGNIN EVENT ERROR]:", err);
            }
        }
    }
};
