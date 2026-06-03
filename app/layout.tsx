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
  title: "TruthLayer — Citation Verification Engine",
  description:
    "A calibrated acceptance gate for citation hallucination in AI search. 3-stage detector pipeline with inspectable signals, answer-level gate decisions, and paper-grade evaluation.",
  authors: [{ name: "Tanush Appapogu" }],
  keywords: [
    "hallucination detection",
    "citation verification",
    "AI search",
    "fact-checking",
    "NLI",
    "acceptance gate",
    "Perplexity",
  ],
  metadataBase: new URL("https://truthlayer.vercel.app"),
  openGraph: {
    title: "TruthLayer — Citation Verification Engine",
    description:
      "A calibrated acceptance gate for citation hallucination in AI search.",
    siteName: "TruthLayer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TruthLayer",
    description:
      "A calibrated acceptance gate for citation hallucination in AI search.",
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
