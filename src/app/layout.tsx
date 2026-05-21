import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Chathead } from "@/components/Chathead";
import { LiveOrderTicker } from "@/components/LiveOrderTicker";
import { AntigravityCursor } from "@/components/AntigravityCursor";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CYNETWORK | Amplify Your Reach",
  description: "Gain Genuine Followers, Reactions, and Views instantly.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col antialiased`}>
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        <AntigravityCursor />
        {children}
        <Chathead />
        <LiveOrderTicker />
      </body>
    </html>
  );
}
