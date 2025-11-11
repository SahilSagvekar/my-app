import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
});

// export const config = {
//   matcher: ["/admin/:path*", "/manager/:path*", "/editor/:path*"],
// };

export const config = {
  matcher: [
    "/admin/:path*",
    "/manager/:path*",
    "/editor/:path*",
    "/videographer/:path*",
    "/qc/:path*",
    "/scheduler/:path*",
    "/client/:path*",
  ],
};