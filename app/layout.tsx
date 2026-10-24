
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Victor | Play Smart. Stake. Win.",
  description:
    "Play chess, challenge friends, compete with virtual coins, join tournaments, and connect with the Chess Victor community.",
  applicationName: "Chess Victor",
  keywords: [
    "Chess Victor",
    "online chess",
    "chess tournaments",
    "chess community",
    "virtual coins",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-shell">
        <div className="app-enter">{children}</div>
      </body>
    </html>
  );
}