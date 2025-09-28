import { createServerClient, type SupabaseClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** SSR client with the **ANON** key. RLS applies. */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // your Next version requires awaiting this

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // <-- NOT service role
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* called in an RSC — safe to ignore if you refresh sessions in middleware */
          }
        },
      },
    }
  );
}
