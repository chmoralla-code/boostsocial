import type { NextConfig } from "next";

const cleanEnvValue = (value: string | undefined) =>
  value?.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  },
};

export default nextConfig;
