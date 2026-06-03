import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quick Start Guide | PinoyBoosting",
  description:
    "Get started with PinoyBoosting in minutes. Create your account, choose your social media boost, and launch your first campaign with our step-by-step Quick Start guide.",
  alternates: {
    canonical: "https://pinoyboosting.com/quick-start",
  },
  openGraph: {
    title: "Quick Start Guide | PinoyBoosting",
    description:
      "Step-by-step guide to create your account and launch your first social media boost on PinoyBoosting.",
    url: "https://pinoyboosting.com/quick-start",
  },
  twitter: {
    title: "Quick Start Guide | PinoyBoosting",
    description:
      "Step-by-step guide to create your account and launch your first social media boost on PinoyBoosting.",
  },
};

export default function QuickStartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
