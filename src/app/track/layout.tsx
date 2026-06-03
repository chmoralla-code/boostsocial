import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Status Tracker | PinoyBoosting",
  description: "Track your PinoyBoosting order status in real-time. Enter your tracking ID to check delivery progress for your social media boost.",
  alternates: {
    canonical: "https://pinoyboosting.com/track",
  },
  openGraph: {
    title: "Order Status Tracker | PinoyBoosting",
    description: "Track your PinoyBoosting order status in real-time. Enter your tracking ID to check delivery progress for your social media boost.",
    url: "https://pinoyboosting.com/track",
  },
  twitter: {
    title: "Order Status Tracker | PinoyBoosting",
    description: "Track your PinoyBoosting order status in real-time. Enter your tracking ID to check delivery progress for your social media boost.",
  },
};

export default function TrackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
