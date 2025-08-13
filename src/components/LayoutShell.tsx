'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { SearchInput } from './SearchInput';
import { Notifications } from './Notifications';
import { Settings } from './Settings';
import {
  LogOut,
  User,
  Search,
  Menu,
  X,
  Settings as SettingsIcon,
} from 'lucide-react';
import { NAVIGATION_ITEMS, type NavigationRole } from './constants/navigation';
import {
  ROLE_COLORS,
  getUserDisplayName,
  getUserAvatar,
  type UserRole,
} from './constants/roles';
import Image from 'next/image';

interface LayoutShellProps {
  currentRole: string;
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const items = NAVIGATION_ITEMS[currentRole as NavigationRole] || [];

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={toggleSidebar}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo.png"
                alt="E8 Logo"
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
                priority
              />
              <span className="hidden sm:block font-semibold text-lg text-gray-900">
                {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)} Portal
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
            <Button variant="ghost" size="sm" className="md:hidden">
              <Search className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            <Notifications currentRole={currentRole} />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getUserAvatar(currentRole as UserRole)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium">
                      {getUserDisplayName(currentRole as UserRole)}
                    </div>
                    <Badge
                      className={`text-xs ${ROLE_COLORS[currentRole as UserRole]}`}
                    >
                      {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`
        fixed top-16 left-0 z-20 w-72 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
      >
        <div className="flex flex-col h-full">
          {/* Mobile close button */}
          <div className="lg:hidden flex justify-end p-4">
            <Button variant="ghost" size="sm" onClick={toggleSidebar}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id);
                    setIsSidebarOpen(false); // Close mobile sidebar
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors
                    ${
                      isActive
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
              {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)} Portal v2.1
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
      <main className="lg:ml-72 pt-16">
        <div className="p-6 sm:p-8">{children}</div>
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
    </div>
  );
}
