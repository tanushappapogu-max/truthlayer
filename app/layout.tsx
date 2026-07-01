import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TruthLayer — Verification-Augmented Generation",
  description:
    "An architectural layer for reducing citation hallucination in transformer pipelines. 99.1% accuracy on decided cases with 0.8% false accept rate using deterministic signals.",
  authors: [{ name: "Tanush Appapogu" }],
  keywords: [
    "verification-augmented generation",
    "hallucination detection",
    "citation verification",
    "transformer architecture",
    "RAG pipeline",
    "acceptance gate",
    "deterministic signals",
    "NLI",
  ],
  metadataBase: new URL("https://truthlayer.vercel.app"),
  openGraph: {
    title: "TruthLayer — Verification-Augmented Generation",
    description:
      "An architectural layer for reducing citation hallucination in transformer pipelines. 99.1% accuracy, 0.8% false accept rate.",
    siteName: "TruthLayer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TruthLayer",
    description:
      "Verification-Augmented Generation: reducing citation hallucination in transformer pipelines through deterministic signal architecture.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
