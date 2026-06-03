import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Page | PinoyBoosting",
  description: "Order custom Facebook pages with followers, social media boosts, and more from PinoyBoosting. Fast delivery with GCash payment.",
  alternates: {
    canonical: "https://pinoyboosting.com/order-page",
  },
  openGraph: {
    title: "Order Page | PinoyBoosting",
    description: "Order custom Facebook pages with followers, social media boosts, and more from PinoyBoosting. Fast delivery with GCash payment.",
    url: "https://pinoyboosting.com/order-page",
  },
  twitter: {
    title: "Order Page | PinoyBoosting",
    description: "Order custom Facebook pages with followers, social media boosts, and more from PinoyBoosting. Fast delivery with GCash payment.",
  },
};

export default function OrderPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
