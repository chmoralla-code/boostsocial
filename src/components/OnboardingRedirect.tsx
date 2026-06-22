"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const SKIP_PATHS = [
  "/quick-start",
  "/login",
  "/reset-password",
  "/admin",
  "/admin/",
  "/admin-app",
  "/app",
  "/app/",
];

export function OnboardingRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  const shouldSkip = SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (shouldSkip) return;

    let isMounted = true;
    if (typeof window !== "undefined") {
      const onboarded = localStorage.getItem("onboarded");
      if (onboarded === "true") return;

      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (!isMounted) return;
        if (data?.user) {
          localStorage.setItem("onboarded", "true");
        } else {
          router.push("/quick-start");
        }
      }).catch((err) => {
        console.warn("Onboarding redirect auth check failed:", err);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [router, shouldSkip]);

  return null;
}
