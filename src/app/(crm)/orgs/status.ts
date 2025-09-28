export const STATUS_VALUES = [
  "new",
  "contacted",
  "in_progress",
  "nurturing",
  "qualified",
  "won",
  "lost",
  "inactive",
] as const;

export type LeadStatus = typeof STATUS_VALUES[number];

export const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "in_progress", label: "In progress" },
  { value: "nurturing", label: "Nurturing" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "inactive", label: "Inactive" },
] as const;

export function formatStatus(v: LeadStatus) {
  const m = STATUS_OPTIONS.find((o) => o.value === v);
  return m ? m.label : v;
}
