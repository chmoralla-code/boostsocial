import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program | PinoyBoosting",
  description: "Earn commissions by referring customers to PinoyBoosting. Join our affiliate program and start earning from social media boosting referrals.",
  alternates: {
    canonical: "https://pinoyboosting.com/affiliate",
  },
  openGraph: {
    title: "Affiliate Program | PinoyBoosting",
    description: "Earn commissions by referring customers to PinoyBoosting. Join our affiliate program and start earning from social media boosting referrals.",
    url: "https://pinoyboosting.com/affiliate",
  },
  twitter: {
    title: "Affiliate Program | PinoyBoosting",
    description: "Earn commissions by referring customers to PinoyBoosting. Join our affiliate program and start earning from social media boosting referrals.",
  },
};

export default function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
