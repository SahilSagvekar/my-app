import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./../components/auth/AuthContext";
import { Toaster } from 'sonner';
import { buildMetadata } from "@/lib/seo";
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
          <Toaster position="bottom-right" />
        </AuthProvider>
       <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-E7HJLKVEPQ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-E7HJLKVEPQ');`}
        </Script>
      </body>
    </html>
  );
}
