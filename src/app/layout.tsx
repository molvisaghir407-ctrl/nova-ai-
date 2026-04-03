import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nova AI — Kimi K2.5 Assistant",
  description: "Nova is a powerful AI assistant powered by Kimi K2.5 with 128k context, extended thinking, vision, and deep memory.",
  keywords: ["Nova", "AI Assistant", "Kimi K2.5", "128k context", "extended thinking"],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-foreground`}>
        {children}
        <Toaster position="bottom-right" richColors closeButton theme="dark" />
      </body>
    </html>
  );
}
