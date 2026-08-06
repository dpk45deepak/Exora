import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Integrity Auditor — Exam Session",
  description: "Cryptographic exam proctoring & behavioral integrity auditing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
