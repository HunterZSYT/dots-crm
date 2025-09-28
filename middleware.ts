// middleware.ts
import { type NextRequest } from "next/server";
import { updateSession } from "./src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // run on app pages only; skip API, static, auth callback, and login
    '/((?!api|_next/static|_next/image|favicon.ico|auth/callback|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
