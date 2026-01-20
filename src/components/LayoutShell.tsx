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

  const isQC = currentRole?.toLowerCase() === 'qc';

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
    <div className={`min-h-screen ${isQC ? 'bg-[#0a0e1a]' : 'bg-gray-50'}`}>
      {/* Top Bar */}
      <header className={`fixed top-0 left-0 right-0 z-30 border-b transition-colors duration-200 ${
        isQC 
          ? 'bg-[#0f1218] border-[#1e2330] shadow-lg' 
          : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className={`flex items-center justify-between px-6 ${isQC ? 'h-14' : 'h-16'}`}>
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className={`lg:hidden ${
                isQC 
                  ? 'text-gray-300 hover:text-gray-100 hover:bg-[#1a1f2e]' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
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
                className={`w-8 h-8 object-contain ${isQC ? 'invert grayscale brightness-200' : ''}`}
                priority
              />
              <span className={`hidden sm:block font-semibold text-lg ${isQC ? 'text-gray-100' : 'text-gray-900'}`}>
                {roleDisplay} Portal
              </span>
            </div>
          </div>

          {/* Center Section - Search */}
          <div className={`hidden md:block flex-1 mx-8 ${isQC ? 'max-w-2xl' : 'max-w-md'}`}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isQC ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                placeholder="Search in tasks..."
                className={`w-full border rounded-lg pl-10 pr-4 py-2 text-sm transition-all focus:outline-none focus:ring-1 ${
                  isQC 
                    ? 'bg-[#1a1f2e] border-[#2a3142] text-gray-200 placeholder-gray-500 focus:border-blue-500/50 focus:ring-blue-500/50' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary/50 focus:ring-primary/50'
                }`}
              />
            </div>
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
                <Button variant="ghost" className={`flex items-center gap-2 px-2 transition-colors ${
                  isQC 
                    ? 'hover:bg-[#1a1f2e] text-gray-300 hover:text-gray-100' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}>
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
                    <div className={`text-sm font-medium ${isQC ? 'text-gray-200' : 'text-gray-900'}`}>
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
              
              <DropdownMenuContent align="end" className={`w-56 shadow-xl border ${
                isQC ? 'bg-[#1e2330] border-[#2a3142] text-gray-100' : 'bg-white border-gray-200 text-gray-900'
              }`}>
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
                      <p className={`text-xs truncate ${isQC ? 'text-gray-400' : 'text-gray-500'}`}>
                        {userData.email}
                      </p>
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator />
                
                 <DropdownMenuItem 
                  onClick={() => setIsSettingsOpen(true)}
                  className={`transition-colors cursor-pointer ${
                    isQC 
                      ? 'hover:bg-[#252b3d] focus:bg-[#252b3d] focus:text-gray-100' 
                      : 'hover:bg-gray-100 focus:bg-gray-100'
                  }`}
                >
                  <User className={`mr-2 h-4 w-4 ${isQC ? 'text-gray-400' : 'text-gray-500'}`} />
                  Profile
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                 <DropdownMenuItem
                  onClick={onLogout}
                  className={`transition-colors cursor-pointer ${
                    isQC 
                      ? 'text-red-400 hover:bg-red-900/20 focus:bg-red-900/20 focus:text-red-400' 
                      : 'text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-600'
                  }`}
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
        fixed left-0 z-20 transform transition-all duration-200 ease-in-out border-r
        ${isQC ? 'top-14 w-64 bg-[#0a0e1a] border-[#1e2330]' : 'top-16 w-72 bg-white border-gray-200'}
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        h-[calc(100vh-${isQC ? '3.5rem' : '4rem'})]
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
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {/* MAIN Section */}
            <div className={isQC ? 'mb-4' : 'mb-6'}>
              <h3 className={`px-3 mb-2 text-xs font-semibold uppercase tracking-wider ${
                isQC ? 'text-gray-500' : 'text-gray-400'
              }`}>
                Main
              </h3>
              {items.slice(0, 3).map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onPageChange(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-all group
                      ${
                        isActive
                          ? isQC 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                            : 'bg-primary text-primary-foreground shadow-sm'
                          : isQC
                            ? 'text-gray-400 hover:bg-[#141824] hover:text-gray-200'
                            : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon className={`h-4 w-4 ${
                      isActive 
                        ? (isQC ? 'text-white' : 'text-primary-foreground') 
                        : (isQC ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-700')
                    }`} />
                    <span className={isActive ? 'font-semibold' : 'font-medium'}>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* OTHER Section */}
            {items.length > 3 && (
              <div>
                <h3 className={`px-3 mb-2 text-xs font-semibold uppercase tracking-wider ${
                  isQC ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  Other
                </h3>
                {items.slice(3).map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onPageChange(item.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-all group
                        ${
                          isActive
                            ? isQC 
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                              : 'bg-primary text-primary-foreground shadow-sm'
                            : isQC
                              ? 'text-gray-400 hover:bg-[#141824] hover:text-gray-200'
                              : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <Icon className={`h-4 w-4 ${
                        isActive 
                          ? (isQC ? 'text-white' : 'text-primary-foreground') 
                          : (isQC ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-700')
                      }`} />
                      <span className={isActive ? 'font-semibold' : 'font-medium'}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className={`p-3 border-t ${isQC ? 'border-[#1e2330]' : 'border-gray-100'}`}>
            <div className={`text-xs text-center ${isQC ? 'text-gray-500' : 'text-gray-400'}`}>
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
      <main className={`transition-all duration-200 ${isQC ? 'lg:ml-64' : 'lg:ml-72'} ${isQC ? 'pt-14' : 'pt-16'}`}>
        <div className={`p-6 sm:p-8 ${isQC ? 'bg-[#0a0e1a] min-h-[calc(100vh-3.5rem)]' : ''}`}>{children}</div>
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

