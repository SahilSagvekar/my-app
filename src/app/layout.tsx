import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./../components/auth/AuthContext";
import { SchedulerActivityTracker } from "@/components/tracking/SchedulerActivityTracker";
import { Toaster } from 'sonner';
import { buildMetadata } from "@/lib/seo";
import CookieConsent from "@/components/CookieConsent";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const GA_MEASUREMENT_ID = "G-HYRHQ43GCE";

export const metadata: Metadata = buildMetadata({
  title: "E8 Productions",
  description:
    "Video production, social media content and digital marketing that helps brands grow.",
  image: "/image.png",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
          <AuthProvider>
            {children}
            <SchedulerActivityTracker />
            <Toaster position="bottom-left" />
            {/* GA is NOT loaded unconditionally — CookieConsent handles opt-in */}
            <CookieConsent measurementId={GA_MEASUREMENT_ID} />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}