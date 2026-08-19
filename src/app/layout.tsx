import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
  title: "Nemus África — Tender Intelligence",
  description: "Tender Intelligence Platform for Nemus África",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
