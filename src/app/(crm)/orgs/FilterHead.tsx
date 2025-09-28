"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter as FilterIcon } from "lucide-react";

export default function FilterHead({
  label,
  param,
  options,
  selected = [],
  allLabel = "All",
}: {
  label: string;
  param: string;
  options: string[];
  selected?: string[] | string | null;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(false);

  // Normalize the selected values passed in from the page
  const selectedArr = React.useMemo<string[]>(
    () =>
      Array.isArray(selected)
        ? selected
        : selected
        ? [String(selected)]
        : [],
    [selected]
  );

  // Prepare option list (unique + sorted)
  const uniqueOptions = React.useMemo(
    () =>
      Array.from(new Set(options.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [options]
  );

  // Local draft that we edit without navigating
  const [draft, setDraft] = React.useState<string[]>(selectedArr);

  // Whenever the menu opens, sync the draft to what’s currently applied
  React.useEffect(() => {
    if (open) setDraft(selectedArr);
  }, [open, selectedArr]);

  const pushValues = (vals: string[]) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete(param);
    vals.forEach((v) => params.append(param, v));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleDraft = (value: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return [...next];
    });
  };

  const selectAllDraft = () => setDraft(uniqueOptions);
  const clearAllDraft = () => setDraft([]);

  const applyAndClose = () => {
    pushValues(draft);
    setOpen(false);
  };

  // Auto-apply if user closes the menu without pressing "Apply"
  const onOpenChange = (v: boolean) => {
    if (!v) {
      // Only push if something actually changed
      const changed =
        draft.length !== selectedArr.length ||
        draft.some((x) => !selectedArr.includes(x));
      if (changed) pushValues(draft);
    }
    setOpen(v);
  };

  const countApplied = selectedArr.length;
  const draftSet = React.useMemo(() => new Set(draft), [draft]);

  return (
    <div className="inline-flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Filter ${label}`}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
          >
            <FilterIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-56">
          <div className="flex items-center justify-between px-2 py-1">
            <DropdownMenuLabel className="px-0 py-0">
              {label}
              {countApplied > 0 ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({countApplied} selected)
                </span>
              ) : (
                <span className="ml-2 text-xs text-muted-foreground">
                  {allLabel}
                </span>
              )}
            </DropdownMenuLabel>

            {countApplied > 0 && (
              <button
                className="text-xs text-red-600 hover:underline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setDraft([]);
                  // Also clear immediately when user hits the quick "Clear"
                  pushValues([]);
                  setOpen(false);
                }}
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          <DropdownMenuSeparator />

          <div className="max-h-64 overflow-y-auto py-1">
            {uniqueOptions.length === 0 ? (
              <div className="px-2 py-1 text-sm text-muted-foreground">
                No options
              </div>
            ) : (
              uniqueOptions.map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt}
                  checked={draftSet.has(opt)}
                  onCheckedChange={() => toggleDraft(opt)}
                  // prevent Radix from closing on item click
                  onSelect={(e) => e.preventDefault()}
                  className="capitalize"
                >
                  {opt}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </div>

          <DropdownMenuSeparator />

          <div className="flex items-center justify-between px-2 py-1">
            <button
              className="text-xs hover:underline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={selectAllDraft}
              type="button"
            >
              Select all
            </button>
            <div className="flex items-center gap-2">
              <button
                className="text-xs hover:underline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearAllDraft}
                type="button"
              >
                Clear all
              </button>
              <Button
                size="sm"
                className="h-7 px-3"
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyAndClose}
                type="button"
              >
                Apply
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* little inline indicator + quick clear */}
      {countApplied > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-red-600">({countApplied})</span>
          <button
            className="text-[11px] text-red-600 hover:underline"
            onClick={() => pushValues([])}
            type="button"
          >
            clear
          </button>
        </div>
      )}
    </div>
  );
}
