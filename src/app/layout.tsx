import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./../components/auth/AuthContext";
import { Toaster } from 'sonner';
import { buildMetadata } from "@/lib/seo";
import CookieConsent from "@/components/CookieConsent";

const GA_MEASUREMENT_ID = "G-E7HJLKVEPQ";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: 'swap',
});

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
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${inter.className} antialiased`}
      >
        <AuthProvider>
          {children}
          <Toaster position="bottom-left" />
          {/* GA is NOT loaded unconditionally — CookieConsent handles opt-in */}
          <CookieConsent measurementId={GA_MEASUREMENT_ID} />
        </AuthProvider>
      </body>
    </html>
  );
}