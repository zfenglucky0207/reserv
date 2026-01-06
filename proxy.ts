import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/server/middleware";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ✅ ALWAYS allow API routes through untouched
  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // 👇 everything else can be proxied
  return await updateSession(req);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

