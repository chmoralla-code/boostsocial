import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | PinoyBoosting",
  description: "Sign in to your PinoyBoosting account to manage orders, track boosts, and access your dashboard.",
  alternates: {
    canonical: "https://pinoyboosting.com/login",
  },
  openGraph: {
    title: "Sign In | PinoyBoosting",
    description: "Sign in to your PinoyBoosting account to manage orders, track boosts, and access your dashboard.",
    url: "https://pinoyboosting.com/login",
  },
  twitter: {
    title: "Sign In | PinoyBoosting",
    description: "Sign in to your PinoyBoosting account to manage orders, track boosts, and access your dashboard.",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
