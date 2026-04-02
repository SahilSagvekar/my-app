"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Camera,
  ChevronDown,
  Clock,
  DollarSign,
  FileText,
  LayoutDashboard,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  TrendingUp as SalesIcon,
  Users,
} from "lucide-react";

import { CreateTaskDialog } from "../../tasks/CreateTaskDialog";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

interface AdminDashboardHeaderProps {
  title: string;
  description: string;
  onPageChange?: (page: string) => void;
  onTaskCreated?: () => void | Promise<void>;
  children?: ReactNode;
}

interface MenuItem {
  page: string;
  label: string;
  icon: typeof LayoutDashboard;
  iconClassName?: string;
}

interface MenuSection {
  label?: string;
  items: MenuItem[];
}

const MANAGEMENT_MENU_SECTIONS: MenuSection[] = [
  {
    items: [
      {
        page: "dashboard",
        label: "Dashboard Overview",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Core Management",
    items: [
      { page: "clients", label: "Client Management", icon: Users },
      { page: "users", label: "User Management", icon: Users },
      { page: "reports", label: "Task Management", icon: FileText },
      {
        page: "sales-management",
        label: "Sales Management",
        icon: SalesIcon,
        iconClassName: "text-yellow-500",
      },
      {
        page: "videographer-management",
        label: "Videographer Management",
        icon: Camera,
        iconClassName: "text-orange-500",
      },
    ],
  },
  {
    label: "Operations & Finance",
    items: [
      {
        page: "monthly-deliverables",
        label: "Monthly Deliverables",
        icon: BarChart3,
        iconClassName: "text-blue-500",
      },
      { page: "finance", label: "Financials & Payouts", icon: DollarSign },
      {
        page: "billing",
        label: "Client Billing",
        icon: FileText,
        iconClassName: "text-green-500",
      },
      { page: "analytics", label: "Client Analytics", icon: BarChart3 },
      { page: "leaves", label: "Leave Management", icon: Clock },
    ],
  },
  {
    label: "System & Compliance",
    items: [
      {
        page: "activity_logs",
        label: "Daily Activity Reports",
        icon: FileText,
      },
      { page: "guidelines", label: "Company Guidelines", icon: BookOpen },
      {
        page: "permissions",
        label: "Role Permissions",
        icon: SettingsIcon,
      },
      { page: "audit", label: "System Audit Log", icon: ShieldCheck },
    ],
  },
];

function ManagementDropdown({
  onPageChange,
}: Pick<AdminDashboardHeaderProps, "onPageChange">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          Manage <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {MANAGEMENT_MENU_SECTIONS.map((section, sectionIndex) => (
          <div key={section.label ?? section.items[0]?.page}>
            {sectionIndex > 0 ? <DropdownMenuSeparator /> : null}

            {section.label ? (
              <DropdownMenuLabel className="text-xs tracking-wider uppercase text-muted-foreground">
                {section.label}
              </DropdownMenuLabel>
            ) : null}

            <DropdownMenuGroup>
              {section.items.map((item) => {
                const Icon = item.icon;

                return (
                  <DropdownMenuItem
                    key={item.page}
                    onClick={() => onPageChange?.(item.page)}
                    className="cursor-pointer gap-2"
                  >
                    <Icon className={`h-4 w-4 ${item.iconClassName ?? ""}`} />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminDashboardHeader({
  title,
  description,
  onPageChange,
  onTaskCreated,
  children,
}: AdminDashboardHeaderProps) {
  return (
    <header className="mb-8 flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        <p className="mt-1 text-lg text-muted-foreground">{description}</p>
      </div>

      <div className="flex w-full items-center gap-3 md:w-auto">
        {children}

        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <ManagementDropdown onPageChange={onPageChange} />
          <CreateTaskDialog
            onTaskCreated={onTaskCreated}
            trigger={
              <Button className="shadow-sm">
                <Plus data-icon="inline-start" />
                Create Task
              </Button>
            }
          />
        </div>
      </div>
    </header>
  );
}
