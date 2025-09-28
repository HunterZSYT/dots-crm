// src/app/(crm)/orgs/Toolbar.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  placeholder?: string;
  /** initial q= value coming from the server page (optional) */
  initialQuery?: string;
};

export default function Toolbar({
  placeholder = "Search…",
  initialQuery = "",
}: Props) {
  const [value, setValue] = useState(initialQuery);
  const router = useRouter();
  const pathname = usePathname();

  // keep the input in sync if the server passes a different q
  useEffect(() => setValue(initialQuery), [initialQuery]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const q = value.trim();
    if (q) params.set("q", q);
    router.push(params.size ? `${pathname}?${params}` : pathname);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        className="w-[320px]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
