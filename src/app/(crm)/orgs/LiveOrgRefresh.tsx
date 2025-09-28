"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LiveOrgRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("orgs-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "organizations" },
        () => router.refresh()
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [router]);

  return null;
}
