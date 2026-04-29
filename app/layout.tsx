import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wayline Travel",
  description: "AI travel command center with Supabase authentication."
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
