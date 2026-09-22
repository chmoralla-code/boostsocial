import type { NextConfig } from "next";

const cleanEnvValue = (value: string | undefined) =>
  value?.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // A stray package-lock.json in the user's home directory made Next.js infer
  // the wrong Turbopack workspace root. Pin it to the project root explicitly
  // (the directory the npm scripts and the Vercel build run from).
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  },
};

export default nextConfig;
