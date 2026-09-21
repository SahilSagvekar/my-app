import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { cn } from "./utils";

// Standard filter-row dropdown. Same look everywhere: a rounded-full pill,
// bold placeholder text doubling as the label (no label above), used for
// page-level filter rows (client/status/deliverable/month, etc.) — not for
// selects inside forms or dialogs, which keep the default Select styling.
//
// Modeled on the pill filter ClientDashboard/QCDashboard's Content Review
// header already used — this just centralizes it so the look changes in
// one place instead of N copy-pasted className strings.

export interface FilterSelectOption {
  value: string;
  label: React.ReactNode;
}

interface FilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: FilterSelectOption[];
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  // Optional label rendered above the pill, for filter rows that were
  // already labeled (e.g. "Client" / "Deliverables" above the dropdown)
  // before being migrated onto this shared component. Leave unset for the
  // bare-pill look (bold placeholder text doubling as the label).
  label?: React.ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  // Optional leading icon inside the pill, before the value text — for
  // filter rows that used an icon-prefixed trigger (e.g. a Calendar icon
  // on a month picker) before being migrated onto this shared component.
  icon?: React.ReactNode;
  // Optional passthrough for selects that need to react to the popover
  // opening (e.g. lazy-loading options on first open).
  onOpenChange?: (open: boolean) => void;
}

export function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
  className,
  contentClassName,
  disabled,
  label,
  labelClassName,
  wrapperClassName,
  icon,
  onOpenChange,
}: FilterSelectProps) {
  const select = (
    <Select value={value} onValueChange={onValueChange} disabled={disabled} onOpenChange={onOpenChange}>
      <SelectTrigger
        className={cn(
          "h-10 w-auto shrink-0 px-3.5 text-xs sm:text-[13px] font-semibold bg-white border border-zinc-200/90 rounded-full text-zinc-900 hover:border-zinc-300 shadow-xs focus:ring-0 cursor-pointer flex items-center justify-between gap-2",
          className,
        )}
      >
        {icon}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn("rounded-xl border border-zinc-200 bg-white shadow-lg", contentClassName)}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs sm:text-sm font-medium">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!label) return select;

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      <label className={cn("text-[12px] font-bold text-gray-500", labelClassName)}>{label}</label>
      {select}
    </div>
  );
}
