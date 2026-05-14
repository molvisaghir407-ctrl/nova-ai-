import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Nova AI — Kimi K2.5 Assistant",
  description: "Nova is a powerful AI assistant powered by Kimi K2.5 with 128k context, extended thinking, vision, and deep memory.",
  keywords: ["Nova", "AI Assistant", "Kimi K2.5", "128k context", "extended thinking"],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-zinc-950 text-foreground`}>
        {children}
        <Toaster position="bottom-right" richColors closeButton theme="dark" />
      </body>
    </html>
  );
}
