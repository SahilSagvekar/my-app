export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbHttp } from "@/lib/db";
import { user as userTable, client as clientTable } from "@/lib/db/schema";
import { and, eq, or, arrayContains } from "drizzle-orm";
import { auth } from "@/auth";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

type AuthMeUser = {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  roles: string[];
  image: string | null;
  linkedClientId: string | null;
  employeeStatus: string | null;
  client: {
    id: string;
    hasPostingServices: boolean;
  } | null;
};

async function getClientLink(user: AuthMeUser) {
  const db = getDbHttp();
  if (user.role !== 'client') {
    return {
      linkedClientId: user.linkedClientId || user.client?.id || null,
      hasPostingServices: user.client?.hasPostingServices ?? true,
    };
  }

  if (user.linkedClientId || user.client?.id) {
    return {
      linkedClientId: user.linkedClientId || user.client?.id,
      hasPostingServices: user.client?.hasPostingServices ?? true,
    };
  }

  const [client] = await db.select({ id: clientTable.id, hasPostingServices: clientTable.hasPostingServices })
    .from(clientTable)
    .where(or(eq(clientTable.email, user.email), arrayContains(clientTable.emails, [user.email])))
    .limit(1);

  return {
    linkedClientId: client?.id || null,
    hasPostingServices: client?.hasPostingServices ?? true,
  };
}

/** Keep authToken JWT in sync with the DB role (fixes stale role:null JWTs
 *  after an admin assigns a role, and issues a token for NextAuth-only logins). */
function withRefreshedAuthCookie(
  response: NextResponse,
  user: { id: number; email: string; role: string | null; roles: string[] | null },
  existingToken: string | null
) {
  if (!process.env.JWT_SECRET) return response;

  let needsRefresh = !existingToken;
  if (existingToken) {
    try {
      const decoded: any = jwt.verify(existingToken, process.env.JWT_SECRET);
      const tokenRole = (decoded.role || '').toLowerCase();
      const dbRole = (user.role || '').toLowerCase();
      const tokenRoles = JSON.stringify(decoded.roles || []);
      const dbRoles = JSON.stringify(user.roles || []);
      if (tokenRole !== dbRole || tokenRoles !== dbRoles || Number(decoded.userId) !== Number(user.id)) {
        needsRefresh = true;
      }
    } catch {
      needsRefresh = true;
    }
  }

  if (!needsRefresh) return response;

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles || [],
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  response.cookies.set('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}

export async function GET(req: Request) {
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);

    // 1. Try Custom JWT Token first
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
        const user = await db.query.user.findFirst({
          where: eq(userTable.id, Number(decoded.userId)),
          columns: {
            id: true,
            email: true,
            name: true,
            role: true,
            roles: true,
            image: true,
            linkedClientId: true,
            employeeStatus: true,
          },
          with: {
            client: {
              columns: { id: true, hasPostingServices: true }
            }
          },
        });

        if (user && (user.employeeStatus === 'ACTIVE' || user.email === 'sahilsagvekar230@gmail.com')) {
          const clientLink = await getClientLink(user);
          const processedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            roles: user.roles,
            image: user.image,
            employeeStatus: user.employeeStatus,
            linkedClientId: clientLink.linkedClientId,
            hasPostingServices: clientLink.hasPostingServices
          };
          const response = NextResponse.json({ user: processedUser }, { status: 200 });
          return withRefreshedAuthCookie(response, user, token);
        }
      } catch {
        // Fall through to NextAuth check if JWT fails
      }
    }

    // 2. Try NextAuth Session (for Google/Slack)
    const session = await auth();
    if (session?.user?.email) {
      const user = await db.query.user.findFirst({
        where: eq(userTable.email, session.user.email),
        columns: {
          id: true,
          email: true,
          name: true,
          role: true,
          roles: true,
          image: true,
          linkedClientId: true,
          employeeStatus: true,
        },
        with: {
          client: {
            columns: { id: true, hasPostingServices: true }
          }
        },
      });

      if (user && (user.employeeStatus === 'ACTIVE' || user.email === 'sahilsagvekar230@gmail.com')) {
        const clientLink = await getClientLink(user);
        const processedUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          roles: user.roles,
          image: user.image,
          employeeStatus: user.employeeStatus,
          linkedClientId: clientLink.linkedClientId,
          hasPostingServices: clientLink.hasPostingServices
        };
        // Issue authToken for NextAuth-only sessions so JWT-gated routes work.
        const response = NextResponse.json({ user: processedUser }, { status: 200 });
        return withRefreshedAuthCookie(response, user, token);
      }
    }

    // No valid auth found
    return NextResponse.json({ user: null }, { status: 200 });
  } catch (error) {
    console.error("DEBUG [ME ROUTE] Error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
