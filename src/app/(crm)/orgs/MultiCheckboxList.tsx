"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
  height?: number; // px; default 192 (h-48)
};

export default function MultiCheckboxList({
  title,
  options,
  selected,
  onChange,
  className,
  height = 192,
}: Props) {
  // keep stable set for O(1) membership checks
  const set = React.useMemo(() => new Set(selected), [selected]);

  const toggle = (value: string, checked: boolean) => {
    const next = new Set(set);
    if (checked) next.add(value);
    else next.delete(value);
    onChange(Array.from(next));
  };

  const selectAll = () => onChange([...new Set(options)]);
  const clearAll = () => onChange([]);

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <div className="space-x-2 text-xs">
          <button type="button" className="underline hover:no-underline" onClick={selectAll}>
            Select all
          </button>
          <button type="button" className="underline hover:no-underline" onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>

      <div
        className="w-full overflow-auto rounded-md border"
        style={{ maxHeight: height }}
        role="group"
        aria-label={title}
      >
        {options.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No columns found</div>
        ) : (
          options.map((opt, i) => {
            const id = `${title.replace(/\s+/g, "-").toLowerCase()}-${i}`;
            const checked = set.has(opt);
            return (
              <label
                key={id}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(v) => toggle(opt, Boolean(v))}
                />
                <span className="truncate text-sm">{opt}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
