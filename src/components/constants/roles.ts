export const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-800',
  editor: 'bg-blue-100 text-blue-800',
  qc: 'bg-green-100 text-green-800',
  scheduler: 'bg-orange-100 text-orange-800',
  manager: 'bg-purple-100 text-purple-800',
  client: 'bg-indigo-100 text-indigo-800',
  videographer: 'bg-pink-100 text-pink-800'
} as const;

export const ROLE_NAMES = {
  admin: 'Admin',
  editor: 'Editor', 
  qc: 'QC Specialist',
  scheduler: 'Scheduler',
  manager: 'Manager',
  client: 'Client',
  videographer: 'Videographer'
} as const;

export type UserRole = keyof typeof ROLE_COLORS;

export const getUserDisplayName = (role: UserRole): string => {
  const names: Record<UserRole, string> = {
    admin: 'Admin User',
    editor: 'Editor User',
    qc: 'QC User',
    scheduler: 'Scheduler User',
    manager: 'Manager User',
    client: 'Client User',
    videographer: 'Video Photographer'
  };
  return names[role];
};

export const getUserAvatar = (role: UserRole): string => {
  const avatars: Record<UserRole, string> = {
    admin: 'AU',
    editor: 'EU',
    qc: 'QU',
    scheduler: 'SU',
    manager: 'MU',
    client: 'CU',
    videographer: 'VP'
  };
  return avatars[role];
};