import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nova AI - Local AI Assistant",
  description: "Nova is a production-ready, fully local AI assistant for Windows PCs. Voice-activated, intelligent, and privacy-focused with comprehensive PC control, web research, and proactive assistance.",
  keywords: ["Nova", "AI Assistant", "Local AI", "Voice Assistant", "Privacy", "Windows", "PC Control", "LLM", "ChatGPT Alternative"],
  authors: [{ name: "Nova AI Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Nova AI - Local AI Assistant",
    description: "Your intelligent, privacy-focused AI assistant with voice control, PC automation, and web research capabilities.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nova AI - Local AI Assistant",
    description: "Your intelligent, privacy-focused AI assistant",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
