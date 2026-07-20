import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = new URL("/og.png", `${protocol}://${host}`);

  return {
    title: "Keypad Lab — SIKAI Hardware Probe",
    description: "A read-only WebHID capability check for the SIKAI two-key RGB macropad.",
    openGraph: {
      title: "Keypad Lab — SIKAI Hardware Probe",
      description: "Safely inspect a SIKAI two-key RGB macropad in your browser.",
      images: [{ url: imageUrl, width: 1536, height: 910, alt: "Keypad Lab read-only SIKAI hardware probe" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Keypad Lab — SIKAI Hardware Probe",
      description: "Safely inspect a SIKAI two-key RGB macropad in your browser.",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
