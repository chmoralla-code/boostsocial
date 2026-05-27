import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Chathead } from "@/components/Chathead";
import { LiveOrderTicker } from "@/components/LiveOrderTicker";
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CYNETWORK | Amplify Your Reach",
  description: "Gain Genuine Followers, Reactions, and Views instantly.",
  icons: {
    icon: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CYNETWORK",
  },
};

export const viewport: Viewport = {
  themeColor: "#1DB954",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col antialiased`}>
        <PWARegister />
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        {children}
        <Chathead />
        <LiveOrderTicker />
      </body>
    </html>
  );
}
