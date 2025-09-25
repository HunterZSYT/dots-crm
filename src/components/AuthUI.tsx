"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "@/lib/supabase/client";

export default function AuthUI() {
  const supabase = createClient();
  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border p-6">
      <Auth
        supabaseClient={supabase}
        providers={["google"]}
        onlyThirdPartyProviders
        appearance={{ theme: ThemeSupa }}
        // optional: where to land after login (else Supabase uses Site URL)
        redirectTo="http://localhost:3000/orgs"
      />
    </div>
  );
}
