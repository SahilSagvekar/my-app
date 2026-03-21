import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// import "../styles/globals.css";
import { AuthProvider } from "./../components/auth/AuthContext";
import { Toaster } from 'sonner';
import { NotificationProvider } from '@/components/NotificationContext';
import { buildMetadata } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = buildMetadata({
  title: "E8 Productions",
  description:
    "Video production, social media content and digital marketing that helps brands grow.",
  image: "/image.png", // public/image.png
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
          <NotificationProvider>
          {children}
          </NotificationProvider>
          <Toaster position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}