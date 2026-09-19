import { cn } from "@/lib/utils";

// Standard page header. Same look everywhere: Admin's spec, copied exact.
// title required. description optional. actions = right side buttons.
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start", className)}>
      <div>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-slate-950">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && (
        <div className="flex w-full items-center gap-3 md:w-auto">
          <div className="ml-auto flex items-center gap-3 md:ml-0">{actions}</div>
        </div>
      )}
    </div>
  );
}