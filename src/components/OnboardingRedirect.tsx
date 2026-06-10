"use client";

import { useEffect, useState } from "react";
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
  const supabase = createClient();

  const shouldSkip = SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (shouldSkip) return;

    let isMounted = true;
    if (typeof window !== "undefined") {
      const onboarded = localStorage.getItem("onboarded");
      if (onboarded === "true") return;

      supabase.auth.getUser().then(({ data }) => {
        if (!isMounted) return;
        if (data?.user) {
          localStorage.setItem("onboarded", "true");
        } else {
          router.push("/quick-start");
        }
      }).catch(() => {
        if (isMounted) {
          router.push("/quick-start");
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [router, supabase, shouldSkip]);

  return null;
}
