import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VIP Program | PinoyBoosting",
  description: "Join PinoyBoosting VIP for exclusive discounts, priority processing, and premium social media boosting services in the Philippines.",
  alternates: {
    canonical: "https://pinoyboosting.com/vip",
  },
  openGraph: {
    title: "VIP Program | PinoyBoosting",
    description: "Join PinoyBoosting VIP for exclusive discounts, priority processing, and premium social media boosting services in the Philippines.",
    url: "https://pinoyboosting.com/vip",
  },
  twitter: {
    title: "VIP Program | PinoyBoosting",
    description: "Join PinoyBoosting VIP for exclusive discounts, priority processing, and premium social media boosting services in the Philippines.",
  },
};

export default function VipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
