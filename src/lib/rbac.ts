import { acoesPermissao } from "@/lib/permissoes";

export type PermissionAction = (typeof acoesPermissao)[number];
export type PermissionValues = Partial<Record<PermissionAction, boolean>>;

export type UserPermissions = {
  administradorTotal: boolean;
  recursos: Record<string, PermissionValues>;
};

export type AuthenticatedUser = {
  id: string;
  nome: string;
  email: string;
  perfilNome: string | null;
  permissoes: UserPermissions;
};
export type GrantablePermission = {
  resourceKey: string;
  permissions: PermissionValues;
};
export type PermissionWithResource = {
  recurso: { slug: string };
} & PermissionValues;

export function can(
  userPermissions: UserPermissions | null | undefined,
  resourceKey: string,
  action: PermissionAction,
): boolean {
  if (!userPermissions) return false;
  if (userPermissions.administradorTotal) return true;
  return userPermissions.recursos[resourceKey]?.[action] === true;
}

export function canGrantPermissions(
  actorPermissions: UserPermissions,
  permissions: GrantablePermission[],
): boolean {
  if (actorPermissions.administradorTotal) return true;
  return permissions.every(({ resourceKey, permissions: values }) =>
    acoesPermissao.every(
      (action) => values[action] !== true || can(actorPermissions, resourceKey, action),
    ),
  );
}

export function toGrantablePermissions(
  permissions: PermissionWithResource[],
): GrantablePermission[] {
  return permissions.map(({ recurso, ...values }) => ({
    resourceKey: recurso.slug,
    permissions: values,
  }));
}
