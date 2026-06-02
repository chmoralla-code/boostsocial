import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { isAdminEmail } from "@/utils/security/admin";

// Service role client to perform bulletproof settings query (bypassing any client-side RLS limitations)
const getServiceRoleClient = () =>
  createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    { auth: { persistSession: false } }
  )

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname
  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/')
  const isAdminApi = pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  const applySecurityHeaders = (response: NextResponse) => {
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    return response;
  };

  // 1. Determine if this request is on a path that MUST bypass maintenance mode
  const isBypassPath =
    isAdminArea ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/announcement')

  // 2. Perform maintenance lockout if not on a bypass route
  if (!isBypassPath) {
    try {
      const adminDb = getServiceRoleClient()
      const { data: configRecord } = await adminDb
        .from('settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single()

      const configValue = configRecord?.value as { enabled?: boolean } | null
      
      if (configValue?.enabled) {
        return applySecurityHeaders(new NextResponse(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Under Maintenance</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --spotify-green: #1DB954;
      --spotify-dark: #0a0a0a;
      --spotify-grey: #121212;
      --spotify-light-grey: #181818;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: var(--spotify-dark);
      color: #cbd5e1;
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }
    
    /* Technical Grid Backdrop */
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255, 255, 255, 0.008) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.008) 1px, transparent 1px);
      background-size: 44px 44px;
      pointer-events: none;
      z-index: 1;
    }
    
    /* Neon Glow Blobs */
    .glow-blob-1 {
      position: absolute;
      top: -10%;
      left: 10%;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(29, 185, 84, 0.12) 0%, transparent 70%);
      filter: blur(50px);
      pointer-events: none;
      z-index: 2;
      animation: pulse-glow 8s infinite alternate;
    }
    
    .glow-blob-2 {
      position: absolute;
      bottom: -10%;
      right: 10%;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(29, 185, 84, 0.08) 0%, transparent 70%);
      filter: blur(60px);
      pointer-events: none;
      z-index: 2;
      animation: pulse-glow 12s infinite alternate-reverse;
    }
    
    @keyframes pulse-glow {
      0% { transform: scale(1) translate(0, 0); opacity: 0.7; }
      100% { transform: scale(1.15) translate(30px, -30px); opacity: 0.9; }
    }
    
    /* Glassmorphic Container */
    .container {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 620px;
      padding: 3.5rem 2.5rem;
      margin: 1.5rem;
      background: rgba(24, 24, 24, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 2rem;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      text-align: center;
      animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes fade-in-up {
      0% { opacity: 0; transform: translateY(20px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    
    /* Pulse Technical Badge */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      background: rgba(29, 185, 84, 0.06);
      border: 1px solid rgba(29, 185, 84, 0.2);
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 900;
      letter-spacing: 0.15em;
      color: var(--spotify-green);
      text-transform: uppercase;
      margin-bottom: 2rem;
      box-shadow: 0 4px 20px rgba(29, 185, 84, 0.1);
    }
    
    .badge-dot {
      width: 8px;
      height: 8px;
      background: var(--spotify-green);
      border-radius: 50%;
      position: relative;
    }
    
    .badge-dot::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--spotify-green);
      border-radius: 50%;
      animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    
    @keyframes ping {
      75%, 100% { transform: scale(3); opacity: 0; }
    }
    
    h1 {
      font-size: 2.25rem;
      font-weight: 900;
      line-height: 1.2;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      margin-bottom: 1.5rem;
    }
    
    @media (min-width: 480px) {
      h1 {
        font-size: 2.75rem;
      }
    }
    
    .gradient-text {
      background: linear-gradient(135deg, #ffffff 40%, var(--spotify-green) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    p {
      font-size: 1rem;
      line-height: 1.6;
      color: #94a3b8;
      max-width: 460px;
      margin: 0 auto;
      font-weight: 600;
    }
    
    /* Cyber pulse animation logo */
    .icon-container {
      margin-bottom: 2.5rem;
      position: relative;
      display: inline-flex;
      justify-content: center;
      align-items: center;
    }
    
    .icon-glow {
      position: absolute;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(29, 185, 84, 0.2);
      filter: blur(15px);
      animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    .icon-main {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(18, 18, 18, 0.9);
      border: 2px solid var(--spotify-green);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--spotify-green);
      box-shadow: 0 0 20px rgba(29, 185, 84, 0.3);
      position: relative;
      z-index: 2;
    }
    
    @keyframes pulse-ring {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.35); opacity: 0; }
    }
    
    /* Rotating Outer Telemetry Ring */
    .telemetry-ring {
      position: absolute;
      width: 90px;
      height: 90px;
      border: 1px dashed rgba(29, 185, 84, 0.4);
      border-radius: 50%;
      animation: spin 20s linear infinite;
      z-index: 1;
    }
    
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow-blob-1"></div>
  <div class="glow-blob-2"></div>
  
  <div class="container">
    <div class="icon-container">
      <div class="telemetry-ring"></div>
      <div class="icon-glow"></div>
      <div class="icon-main">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
    </div>
    
    <div class="badge">
      <span class="badge-dot"></span>
      System Status Offline
    </div>
    
    <h1>
      <span class="gradient-text">WEBSITE IS UNDER MAINTAINANCE,<br>WE WILL BE BACK SOON</span>
    </h1>
    
    <p>
      We are currently performing scheduled maintenance to upgrade our systems. Rest assured we will be back shortly with faster and cheaper service amplification speeds!
    </p>
  </div>
</body>
</html>`,
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
          }
        ))
      }
    } catch (err) {
      console.error('Middleware maintenance check error:', err)
    }
  }

  // 3. Perform standard administrator authentication enforcement
  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isAdminArea && request.nextUrl.pathname !== '/admin/login') {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return applySecurityHeaders(NextResponse.redirect(url))
    }

    // Strict role-based protection: only allow emails ending in @boostsocial.com to view administrative console
    if (!isAdminEmail(user.email)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return applySecurityHeaders(NextResponse.redirect(url))
    }
  }

  if (isAdminApi) {
    if (!user) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    if (!isAdminEmail(user.email)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );
    }
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
