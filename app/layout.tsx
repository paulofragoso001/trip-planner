import type { Metadata } from "next";
import { validateEnv } from "@/lib/server/env";
import "./globals.css";

validateEnv();

export const metadata: Metadata = {
  title: "Wayline — AI Travel Companion",
  description:
    "Plan with AI, organize your itinerary, map your route, save documents, track expenses, and share your trip from one travel pass."
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
