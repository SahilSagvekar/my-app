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
import logo from "../../public/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png"

interface LayoutShellProps {
  currentRole: string | null;  // UPDATED: Allow null
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface UserData {
  name: string;
  email: string;
  image: string;
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
  const [userData, setUserData] = useState<UserData>({
    name: '',
    email: '',
    image: '',
  });
  const [loadingUserData, setLoadingUserData] = useState(true);

  // UPDATED: Handle null role
  const items = currentRole ? (NAVIGATION_ITEMS[currentRole as NavigationRole] || []) : [];
  // const roleDisplay = currentRole 
  //   ? currentRole.charAt(0).toUpperCase() + currentRole.slice(1) 
  //   : 'User';

  const roleDisplay = currentRole
  ? currentRole.toLowerCase() === 'qc'
    ? 'QC'
    : currentRole.charAt(0).toUpperCase() + currentRole.slice(1)
  : 'User';

  // Fetch user data on mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      
      if (!token) {
        setLoadingUserData(false);
        return;
      }

      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setUserData({
          name: data.data.name || '',
          email: data.data.email || '',
          image: data.data.image || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoadingUserData(false);
    }
  };

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
            <Button variant="ghost" size="sm" className="md:hidden">
              <Search className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            <Notifications currentRole={currentRole} />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-gray-100">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={userData.image} 
                      alt={userData.name}
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || getUserDisplayName(currentRole as UserRole))}&background=random`;
                      }}
                    />
                    <AvatarFallback className="text-xs">
                      {getUserAvatar(currentRole as UserRole)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium">
                      {userData.name || getUserDisplayName(currentRole as UserRole)}
                    </div>
                    <Badge
                      className={`text-xs ${ROLE_COLORS[currentRole as UserRole]}`}
                    >
                      {roleDisplay}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-56">
                {/* User Info Section */}
                <div className="px-2 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage 
                        src={userData.image} 
                        alt={userData.name}
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || getUserDisplayName(currentRole as UserRole))}&background=random`;
                        }}
                      />
                      <AvatarFallback className="text-xs">
                        {getUserAvatar(currentRole as UserRole)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {userData.name || getUserDisplayName(currentRole as UserRole)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {userData.email}
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

// 'use client';

// import { useState } from 'react';
// import { Button } from './ui/button';
// import { Badge } from './ui/badge';
// import { Separator } from './ui/separator';
// import { Avatar, AvatarFallback } from './ui/avatar';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from './ui/dropdown-menu';
// import { SearchInput } from './SearchInput';
// import { Notifications } from './Notifications';
// import { Settings } from './Settings';
// import {
//   LogOut,
//   User,
//   Search,
//   Menu,
//   X,
//   Settings as SettingsIcon,
// } from 'lucide-react';
// import { NAVIGATION_ITEMS, type NavigationRole } from './constants/navigation';
// import {
//   ROLE_COLORS,
//   getUserDisplayName,
//   getUserAvatar,
//   type UserRole,
// } from './constants/roles';
// import Image from 'next/image';
// import logo from "../../public/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png"

// interface LayoutShellProps {
//   currentRole: string | null;  // UPDATED: Allow null
//   currentPage: string;
//   onPageChange: (page: string) => void;
//   onLogout: () => void;
//   children: React.ReactNode;
// }

// export function LayoutShell({
//   currentRole,
//   currentPage,
//   onPageChange,
//   onLogout,
//   children,
// }: LayoutShellProps) {
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
//   const [isSettingsOpen, setIsSettingsOpen] = useState(false);

//   // UPDATED: Handle null role
//   const items = currentRole ? (NAVIGATION_ITEMS[currentRole as NavigationRole] || []) : [];
//   const roleDisplay = currentRole 
//     ? currentRole.charAt(0).toUpperCase() + currentRole.slice(1) 
//     : 'User';

//   const toggleSidebar = () => {
//     setIsSidebarOpen(!isSidebarOpen);
//   };

//   // UPDATED: Show message if no role assigned
//   if (!currentRole) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <h1 className="text-2xl font-bold mb-2">No Role Assigned</h1>
//           <p className="text-gray-600 mb-4">Please contact an administrator to assign you a role.</p>
//           <Button onClick={onLogout}>Sign Out</Button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Top Bar */}
//       <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
//         <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
//           {/* Left Section */}
//           <div className="flex items-center gap-4">
//             {/* Mobile menu button */}
//             <Button
//               variant="ghost"
//               size="sm"
//               className="lg:hidden"
//               onClick={toggleSidebar}
//             >
//               <Menu className="h-5 w-5" />
//             </Button>

//             {/* Logo */}
//             <div className="flex items-center gap-3">
//               <Image
//                 src={logo}
//                 alt="E8 Logo"
//                 width={32}
//                 height={32}
//                 className="w-8 h-8 object-contain"
//                 priority
//               />
//               <span className="hidden sm:block font-semibold text-lg text-gray-900">
//                 {roleDisplay} Portal
//               </span>
//             </div>
//           </div>

//           {/* Center Section - Search */}
//           <div className="hidden md:block flex-1 max-w-md mx-8">
//             <SearchInput currentRole={currentRole} onPageChange={onPageChange} />
//           </div>

//           {/* Right Section */}
//           <div className="flex items-center gap-3">
//             {/* Mobile search */}
//             <Button variant="ghost" size="sm" className="md:hidden">
//               <Search className="h-5 w-5" />
//             </Button>

//             {/* Notifications */}
//             <Notifications currentRole={currentRole} />

//             {/* User Menu */}
//             <DropdownMenu>
//               <DropdownMenuTrigger asChild>
//                 <Button variant="ghost" className="flex items-center gap-2 px-2">
//                   <Avatar className="h-8 w-8">
//                     <AvatarFallback className="text-xs">
//                       {getUserAvatar(currentRole as UserRole)}
//                     </AvatarFallback>
//                   </Avatar>
//                   <div className="hidden sm:block text-left">
//                     <div className="text-sm font-medium">
//                       {getUserDisplayName(currentRole as UserRole)}
//                     </div>
//                     <Badge
//                       className={`text-xs ${ROLE_COLORS[currentRole as UserRole]}`}
//                     >
//                       {roleDisplay}
//                     </Badge>
//                   </div>
//                 </Button>
//               </DropdownMenuTrigger>
//               <DropdownMenuContent align="end" className="w-56">
//                 <DropdownMenuLabel>My Account</DropdownMenuLabel>
//                 <DropdownMenuSeparator />
//                 {/* <DropdownMenuItem>
//                   <User className="mr-2 h-4 w-4" />
//                   Profile
//                 </DropdownMenuItem> */}
//                 <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
//                   <User className="mr-2 h-4 w-4" />
//                   Profile
//                 </DropdownMenuItem>
//                 <DropdownMenuSeparator />
//                 <DropdownMenuItem
//                   onClick={onLogout}
//                   className="text-red-600"
//                 >
//                   <LogOut className="mr-2 h-4 w-4" />
//                   Sign out
//                 </DropdownMenuItem>
//               </DropdownMenuContent>
//             </DropdownMenu>
//           </div>
//         </div>
//       </header>

//       {/* Sidebar */}
//       <aside
//         className={`
//         fixed top-16 left-0 z-20 w-72 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
//         ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
//         lg:translate-x-0
//       `}
//       >
//         <div className="flex flex-col h-full">
//           {/* Mobile close button */}
//           <div className="lg:hidden flex justify-end p-4">
//             <Button variant="ghost" size="sm" onClick={toggleSidebar}>
//               <X className="h-5 w-5" />
//             </Button>
//           </div>

//           {/* Navigation */}
//           <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
//             {items.map((item) => {
//               const Icon = item.icon;
//               const isActive = currentPage === item.id;

//               return (
//                 <button
//                   key={item.id}
//                   onClick={() => {
//                     onPageChange(item.id);
//                     setIsSidebarOpen(false); // Close mobile sidebar
//                   }}
//                   className={`
//                     w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors
//                     ${
//                       isActive
//                         ? 'bg-primary text-primary-foreground shadow-sm'
//                         : 'text-gray-700 hover:bg-gray-100'
//                     }
//                   `}
//                 >
//                   <Icon className="h-5 w-5" />
//                   {item.label}
//                 </button>
//               );
//             })}
//           </nav>

//           {/* Footer */}
//           <div className="p-4 border-t border-gray-200">
//             <div className="text-xs text-gray-500 text-center">
//               {roleDisplay} Portal v2.1
//             </div>
//           </div>
//         </div>
//       </aside>

//       {/* Mobile Overlay */}
//       {isSidebarOpen && (
//         <div
//           className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
//           onClick={toggleSidebar}
//         />
//       )}

//       {/* Main Content */}
//       <main className="lg:ml-72 pt-16">
//         <div className="p-6 sm:p-8">{children}</div>
//       </main>

//       {/* Settings Dialog */}
//       {isSettingsOpen && (
//         <div className="fixed inset-0 bg-background z-50 flex flex-col">
//           <Settings
//             currentRole={currentRole}
//             onClose={() => setIsSettingsOpen(false)}
//           />
//         </div>
//       )}
//     </div>
//   );
// }

