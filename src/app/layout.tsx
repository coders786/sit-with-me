import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sit With Me — Your AI Learning Companion",
  description: "The teacher you always wished you had. An agentic AI mentor that sits next to you, plans your learning, and adapts to how you learn.",
  keywords: ["AI", "learning", "mentor", "companion", "education", "Gemini"],
  authors: [{ name: "coders786" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0e0f13] text-[#eef0f4]`}
      >
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
