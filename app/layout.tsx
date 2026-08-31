import type { Metadata } from "next";
import localFont from "next/font/local";
import { CapacitorAuthSessionBridge } from "@/components/native/capacitor-auth-session-bridge";
import { validateEnv } from "@/lib/server/env";
import "./globals.css";

validateEnv();

const instrumentSans = localFont({
  src: [
    {
      path: "../ios/App/App/Fonts/InstrumentSans/InstrumentSans-Regular.ttf",
      weight: "400",
      style: "normal"
    },
    {
      path: "../ios/App/App/Fonts/InstrumentSans/InstrumentSans-Medium.ttf",
      weight: "500",
      style: "normal"
    },
    {
      path: "../ios/App/App/Fonts/InstrumentSans/InstrumentSans-SemiBold.ttf",
      weight: "600",
      style: "normal"
    },
    {
      path: "../ios/App/App/Fonts/InstrumentSans/InstrumentSans-Bold.ttf",
      weight: "700",
      style: "normal"
    }
  ],
  display: "swap",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  preload: true,
  variable: "--font-almidy-product"
});

export const metadata: Metadata = {
  title: "Almidy — AI Travel Companion",
  description:
    "Plan with AI, organize your itinerary, map your route, save documents, track expenses, and share your trip from one travel pass."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={instrumentSans.variable} lang="en">
      <body>
        <CapacitorAuthSessionBridge />
        {children}
      </body>
    </html>
  );
}
