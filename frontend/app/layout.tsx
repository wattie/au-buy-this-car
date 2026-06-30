import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Should I Buy This Car?",
  description:
    "AI-assisted used-car analysis for quick demo recommendations, risk checks, and negotiation guidance."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
