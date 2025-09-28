// src/components/AuthUI.tsx
"use client";
import { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "@/lib/supabase/client";

export default function AuthUI() {
  const supabase = createClient();
  const [redirectTo, setRedirectTo] = useState<string | undefined>();

  useEffect(() => {
    setRedirectTo(`${window.location.origin}/auth/callback`);
  }, []);

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border p-6">
      <Auth
        supabaseClient={supabase}
        providers={["google"]}
        appearance={{ theme: ThemeSupa }}
        redirectTo={redirectTo}
        // allow email/password too (remove onlyThirdPartyProviders)
      />
    </div>
  );
}
