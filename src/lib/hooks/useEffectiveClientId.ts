"use client";

import { useAuth } from "@/components/auth/AuthContext";
import { useViewAsRole } from "@/components/auth/ViewAsRoleContext";

/**
 * The client ID that "my client" data-fetching should scope to.
 *
 * - A real client user: their own linkedClientId.
 * - An admin/manager previewing a specific client's portal via the switch
 *   role dropdown (see ViewAsRoleContext's CLIENT_PREVIEW_MAP): that
 *   client's ID takes priority over the admin's own (always-null)
 *   linkedClientId, so their view matches what the real client sees.
 * - Anyone else: null.
 *
 * Use this anywhere a component currently reads `user.linkedClientId`
 * directly for its own data-fetching (billing, contracts, social,
 * drive, logins, posted content, etc.) so client-portal previews work
 * consistently across every tab.
 */
export function useEffectiveClientId(): string | null {
  const { user } = useAuth();
  const { viewingAsClientId } = useViewAsRole();
  return viewingAsClientId || user?.linkedClientId || null;
}