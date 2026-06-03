import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { FloatingSiteWidgets } from "@/components/FloatingSiteWidgets";
import { ClientAppUpdateButton } from "@/components/ClientAppUpdateButton";
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://pinoyboosting.com"),
  title: {
    default: "PinoyBoosting | Philippines Social Media Boosting Services",
    template: "%s | PinoyBoosting",
  },
  description: "PinoyBoosting provides Philippines-focused Facebook, Instagram, TikTok, YouTube, Telegram, and social media boosting services with order tracking, wallet top-ups, and VIP discounts.",
  applicationName: "PinoyBoosting",
  keywords: [
    "pinoyboosting",
    "PinoyBoosting",
    "Pinoy Boosting",
    "Philippines social media boosting",
    "Facebook followers Philippines",
    "Facebook reactions Philippines",
    "SMM services Philippines",
    "GCash SMM services",
  ],
  authors: [{ name: "PinoyBoosting" }],
  creator: "PinoyBoosting",
  publisher: "PinoyBoosting",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "https://pinoyboosting.com",
  },
  openGraph: {
    type: "website",
    locale: "en_PH",
    url: "https://pinoyboosting.com/",
    siteName: "PinoyBoosting",
    title: "PinoyBoosting | Philippines Social Media Boosting Services",
    description: "Order PH-focused Facebook, Instagram, TikTok, YouTube, Telegram, and social media boosting services with tracking, GCash payments, wallet top-ups, and VIP discounts.",
  },
  twitter: {
    card: "summary",
    title: "PinoyBoosting | Philippines Social Media Boosting Services",
    description: "PH-focused social media boosting services with tracking, GCash payments, wallet top-ups, and VIP discounts.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "PinoyBoosting",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://pinoyboosting.com/#organization",
        name: "PinoyBoosting",
        alternateName: "CYNETWORK",
        url: "https://pinoyboosting.com/",
        logo: "https://pinoyboosting.com/icon.svg",
        sameAs: ["https://www.pinoyboosting.com/"],
      },
      {
        "@type": "WebSite",
        "@id": "https://pinoyboosting.com/#website",
        name: "PinoyBoosting",
        alternateName: "Pinoy Boosting",
        url: "https://pinoyboosting.com/",
        publisher: {
          "@id": "https://pinoyboosting.com/#organization",
        },
        inLanguage: "en-PH",
      },
    ],
  };

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <PWARegister />
        {children}
        <FloatingSiteWidgets />
        <ClientAppUpdateButton />
      </body>
    </html>
  );
}
