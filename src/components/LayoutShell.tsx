'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { SearchInput } from './SearchInput';
// import { Notifications } from './Notifications';
import { Settings } from './Settings';
import {
  LogOut,
  User,
  Search,
  X,
  Settings as SettingsIcon,
  ArrowLeftRight,
  FileText
} from 'lucide-react';
import { GlobalUploadManager } from './workflow/GlobalUploadManager';
import { NAVIGATION_ITEMS, type NavigationRole } from './constants/navigation';
import {
  ROLE_COLORS,
  getUserDisplayName,
  getUserAvatar,
  type UserRole,
} from './constants/roles';
import Image from 'next/image';
import logo from "../../public/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png"
import { useAuth } from './auth/AuthContext';
import { useViewAsRole } from './auth/ViewAsRoleContext';

function MenuToggleIcon({ isCollapsed, className }: { isCollapsed?: boolean; className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M3 18h18" />
      {isCollapsed ? (
        <>
          <path d="M3 12h14" />
          <path d="m13 8 4 4-4 4" />
        </>
      ) : (
        <>
          <path d="M21 12H7" />
          <path d="m11 8-4 4 4 4" />
        </>
      )}
    </svg>
  );
}

interface LayoutShellProps {
  currentRole: string | null;  // UPDATED: Allow null
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function LayoutShell({
  currentRole,
  currentPage,
  onPageChange,
  onLogout,
  children,
}: LayoutShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [permittedItems, setPermittedItems] = useState<any[]>([]);
  const [navLoading, setNavLoading] = useState(true);
  const { user: authUser } = useAuth();

  // 🔥 Role switching feature
  const { canSwitchRole, isViewingAsOther, switchableRoles, switchToRole, resetToOriginal } = useViewAsRole();

  const roleDisplay = currentRole
    ? currentRole.toLowerCase() === 'qc'
      ? 'QC'
      : currentRole.charAt(0).toUpperCase() + currentRole.slice(1).toLowerCase()
    : 'User';

  // UPDATED: Handle null role
  // UPDATED: Fetch permitted navigation items
  useEffect(() => {
    if (!currentRole) return;
    const controller = new AbortController();
    const normalizedRole = (currentRole as string).toLowerCase() as NavigationRole;
    const clientForbiddenIds = ['posted', 'monthly-overview', 'youtube-analytics', 'instagram-analytics', 'archive', 'feedback'];

    const applyClientFilter = (data: any[]) => {
      if (normalizedRole === 'client' && authUser?.hasPostingServices === false) {
        return data.filter((item: any) => !clientForbiddenIds.includes(item.id));
      }
      return data;
    };

    const fallback = () => {
      const data = applyClientFilter([...(NAVIGATION_ITEMS[normalizedRole] || [])]);
      setPermittedItems(data);
    };

    const fetchNavItems = async () => {
      try {
        setNavLoading(true);
        const res = await fetch(`/api/user/navigation?role=${currentRole}`, {
          signal: controller.signal,
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) { fallback(); return; }
        let data = applyClientFilter(await res.json());
        // Safety: if API returned items that don't belong to this role's nav, fall back to defaults
        const roleIds = new Set((NAVIGATION_ITEMS[normalizedRole] || []).map((i: any) => i.id));
        const validData = data.filter((item: any) => roleIds.has(item.id) || item._dynamicInjected);
        setPermittedItems(validData.length > 0 ? validData : applyClientFilter([...(NAVIGATION_ITEMS[normalizedRole] || [])]));
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error("Failed to fetch navigation:", err);
        fallback();
      } finally {
        setNavLoading(false);
      }
    };

    fetchNavItems();
    return () => controller.abort();
  }, [currentRole, authUser?.hasPostingServices]);

  const items = permittedItems;

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // UPDATED: Show message if no role assigned
  if (!currentRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">No Role Assigned</h1>
          <p className="text-gray-600 mb-4">Please contact an administrator to assign you a role.</p>
          <Button onClick={onLogout}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Top Bar */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden min-h-[44px] min-w-[44px]"
              onClick={toggleSidebar}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <MenuToggleIcon className="h-5 w-5" />}
            </Button>

            {/* Logo */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="hidden lg:flex"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              >
                <MenuToggleIcon className="h-5 w-5" isCollapsed={isSidebarCollapsed} />
              </Button>
              <Image
                src={logo}
                alt="E8 Logo"
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
                priority
              />
              <span className="hidden sm:block font-semibold text-lg text-gray-900">
                {roleDisplay} Portal
              </span>
            </div>
          </div>

          {/* Center Section - Search */}
          <div className="hidden md:block flex-1 max-w-md mx-8">
            <SearchInput currentRole={currentRole} onPageChange={onPageChange} />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Mobile search */}
            <Button variant="ghost" size="sm" className="md:hidden min-h-[44px] min-w-[44px]">
              <Search className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            {/* <Notifications currentRole={currentRole} /> */}

            {/* 🔥 Role Switch Dropdown - Styled to match the User/Profile dropdown */}
            {canSwitchRole && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-gray-100">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isViewingAsOther ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      <ArrowLeftRight className="h-4 w-4" />
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium">
                        {isViewingAsOther ? `Viewing: ${roleDisplay}` : 'Switch Role'}
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  {/* User Info Section - matches manage dropdown header */}
                  <div className="px-2 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isViewingAsOther ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        <ArrowLeftRight className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {authUser?.name || getUserDisplayName(currentRole as UserRole)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Current: {roleDisplay}
                        </p>
                      </div>
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Role Items */}
                  {switchableRoles.map((role) => {
                    const isCurrent = currentRole?.toLowerCase() === role.toLowerCase();
                    const roleLabel = role.toLowerCase() === 'qc' ? 'QC Specialist' : role.charAt(0).toUpperCase() + role.slice(1);
                    return (
                      <DropdownMenuItem
                        key={role}
                        onClick={() => switchToRole(role)}
                        className={`cursor-pointer ${isCurrent ? 'bg-amber-50 font-semibold' : ''}`}
                      >
                        <div className={`mr-2 h-2 w-2 rounded-full ${isCurrent ? 'bg-amber-500' : 'bg-gray-300'}`} />
                        {roleLabel}
                        {isCurrent && (
                          <span className="ml-auto text-xs text-amber-600">Active</span>
                        )}
                      </DropdownMenuItem>
                    );
                  })}

                  {/* Reset Option - matches Sign Out style */}
                  {isViewingAsOther && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={resetToOriginal}
                        className="text-amber-600 cursor-pointer"
                      >
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        Reset to {authUser?.role === 'admin' ? 'Admin' : 'Original'}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-gray-100">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={authUser?.image}
                      alt={authUser?.name || ''}
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.name || getUserDisplayName(currentRole as UserRole))}&background=random`;
                      }}
                    />
                    <AvatarFallback className="text-xs">
                      {getUserAvatar(currentRole as UserRole)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium">
                      {authUser?.name || getUserDisplayName(currentRole as UserRole)}
                    </div>
                    {/* <Badge
                      className={`text-xs ${ROLE_COLORS[currentRole as UserRole]}`}
                    >
                      {roleDisplay}
                    </Badge> */}
                  </div>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                {/* User Info Section */}
                <div className="px-2 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={authUser?.image}
                        alt={authUser?.name || ''}
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.name || getUserDisplayName(currentRole as UserRole))}&background=random`;
                        }}
                      />
                      <AvatarFallback className="text-xs">
                        {getUserAvatar(currentRole as UserRole)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {authUser?.name || getUserDisplayName(currentRole as UserRole)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {authUser?.email || ''}
                      </p>
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={onLogout}
                  className="text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`
        fixed top-16 left-0 z-20 w-72 h-[calc(100vh-4rem)] bg-white/80 backdrop-blur-md border-r border-gray-200 transform transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Mobile close button */}
          <div className="lg:hidden flex justify-end p-4">
            <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]" onClick={toggleSidebar}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navLoading ? (
              <div className="space-y-3 px-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : items.map((item) => {
              const normalizedRole = (currentRole as string).toLowerCase() as NavigationRole;
              const Icon = NAVIGATION_ITEMS[normalizedRole]?.find(i => i.id === item.id)?.icon || FileText;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id);
                    setIsSidebarOpen(false); // Close mobile sidebar
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-3 sm:py-2 text-sm rounded-lg transition-colors
                    ${isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              {roleDisplay} Portal v2.1
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Main Content */}
      <main className={`transition-all duration-300 ease-in-out pt-16 ${isSidebarCollapsed ? 'lg:ml-0' : 'lg:ml-72'}`}>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      {/* Settings Dialog */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
          <Settings
            currentRole={currentRole}
            onClose={() => setIsSettingsOpen(false)}
          />
        </div>
      )}

      {/* Global Upload Manager */}
      <GlobalUploadManager />
    </div>
  );
}
