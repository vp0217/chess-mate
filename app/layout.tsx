
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Mate | Play Smart. Stake. Win.",
  description:
    "Play chess, challenge friends, compete with virtual coins, join tournaments, and connect with the Chess Mate community.",
  applicationName: "Chess Mate",
  keywords: [
    "Chess Mate",
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