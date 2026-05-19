import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Chathead } from "@/components/Chathead";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BoostSocial | Amplify Your Reach",
  description: "Gain Genuine Followers, Reactions, and Views instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-[#f4f7fb] text-slate-800 flex flex-col`}>
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        {children}
        <Chathead />
      </body>
    </html>
  );
}
