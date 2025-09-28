// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      
      if (code) {
        const supabase = createClient();
        await supabase.auth.exchangeCodeForSession(code);
      }
      
      router.replace("/orgs");
    }
    
    handleCallback();
  }, [router, searchParams]);

  return <p>Signing you in...</p>;
}