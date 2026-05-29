import type { Metadata } from "next";
import { validateEnv } from "@/lib/server/env";
import "./globals.css";

validateEnv();

export const metadata: Metadata = {
  title: "Wayline — AI Travel Planner",
  description:
    "Turn saved travel ideas into mapped trip plans with smart nearby suggestions."
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
