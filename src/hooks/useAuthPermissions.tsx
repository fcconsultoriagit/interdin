"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { AuthenticatedUser, PermissionAction } from "@/lib/rbac";
import { can } from "@/lib/rbac";

const AuthPermissionsContext = createContext<AuthenticatedUser | null>(null);

export function AuthPermissionsProvider({
  user,
  children,
}: {
  user: AuthenticatedUser | null;
  children: ReactNode;
}) {
  return (
    <AuthPermissionsContext.Provider value={user}>
      {children}
    </AuthPermissionsContext.Provider>
  );
}

export function useAuthPermissions() {
  const user = useContext(AuthPermissionsContext);
  const hasPermission = useCallback(
    (resource: string, action: PermissionAction) => can(user?.permissoes, resource, action),
    [user],
  );
  const canViewMenu = useCallback(
    (resource: string) => hasPermission(resource, "verMenu"),
    [hasPermission],
  );
  return {
    user,
    hasPermission,
    canViewMenu,
  };
}
