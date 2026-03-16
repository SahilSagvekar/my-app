import { auth } from "./auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;

  // 🚀 Standard Protected Routes Handling
  // If not authenticated and trying to access a protected route (defined in matcher),
  // NextAuth v5 'auth' will handle the redirect if configured, but we can also do it explicitly.
  if (!isAuthenticated && nextUrl.pathname !== "/auth/login") {
    // You can add custom redirect logic here if needed
  }
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/manager/:path*",
    "/editor/:path*",
    "/videographer/:path*",
    "/qc/:path*",
    "/scheduler/:path*",
    "/client/:path*",
    "/sales/:path*",
  ],
};
