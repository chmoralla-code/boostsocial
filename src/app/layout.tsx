import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { FloatingSiteWidgets } from "@/components/FloatingSiteWidgets";
import { ClientAppUpdateButton } from "@/components/ClientAppUpdateButton";
import { ClientAppNavigationControls } from "@/components/ClientAppNavigationControls";
import { OnboardingRedirect } from "@/components/OnboardingRedirect";
import { PWARegister } from "@/components/PWARegister";
import { SiteEffects } from "@/components/SiteEffects";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_PH",
    url: "https://pinoyboosting.com/",
    siteName: "PinoyBoosting",
    title: "PinoyBoosting | Philippines Social Media Boosting Services",
    description: "Order PH-focused Facebook, Instagram, TikTok, YouTube, Telegram, and social media boosting services with tracking, GCash payments, wallet top-ups, and VIP discounts.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "PinoyBoosting logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PinoyBoosting | Philippines Social Media Boosting Services",
    description: "PH-focused social media boosting services with tracking, GCash payments, wallet top-ups, and VIP discounts.",
    images: ["/logo.png"],
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
  maximumScale: 5,
  userScalable: true,
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
        logo: {
          "@type": "ImageObject",
          url: "https://pinoyboosting.com/logo.png",
          width: 512,
          height: 512,
        },
        image: "https://pinoyboosting.com/logo.png",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('site-theme');if(!t)t=window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t||'dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${spaceGrotesk.className} min-h-screen bg-bg text-fg flex flex-col antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <PWARegister />
        <SiteEffects />
        <OnboardingRedirect />
        {children}
        <FloatingSiteWidgets />
        <ClientAppUpdateButton />
        <ClientAppNavigationControls />
        <div className="robot-scanlines" aria-hidden="true" />
      </body>
    </html>
  );
}
