"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export default function Toolbar({ initial }: { initial: { q: string } }) {
  const [q, setQ] = useState(initial.q);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => setQ(search.get("q") ?? ""), [search]);

  function push() {
    const params = new URLSearchParams(search.toString());
    q ? params.set("q", q) : params.delete("q");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-xs font-medium">Filter</div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && push()}
        placeholder="Search bar"
        className="max-w-md"
      />
      <button
        onClick={push}
        disabled={isPending}
        className="ml-auto text-sm text-muted-foreground hover:text-foreground transition"
      >
        Apply
      </button>
    </div>
  );
}
