import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Nova AI — DeepSeek · Grok · Claude Hybrid",
  description: "Nova is a powerful AI assistant with DeepSeek reasoning, Grok-speed UI, and Claude artifacts. 128k context, extended thinking, vision, and deep memory.",
  keywords: ["Nova", "AI Assistant", "DeepSeek", "Grok", "Claude", "128k context", "extended thinking", "artifacts"],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
