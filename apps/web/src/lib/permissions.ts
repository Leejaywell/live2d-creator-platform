import { UserRole } from "@prisma/client";

export type Permission =
  | "admin.users.manage"
  | "creators.manage"
  | "plans.manage"
  | "orders.confirm"
  | "quota.grant"
  | "projects.pause"
  | "assets.assist"
  | "fan_codes.manage"
  | "support.notes"
  | "provider_secrets.manage";

const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  super_admin: new Set([
    "admin.users.manage",
    "creators.manage",
    "plans.manage",
    "orders.confirm",
    "quota.grant",
    "projects.pause",
    "assets.assist",
    "fan_codes.manage",
    "support.notes",
    "provider_secrets.manage",
  ]),
  ops_admin: new Set([
    "creators.manage",
    "plans.manage",
    "orders.confirm",
    "quota.grant",
    "projects.pause",
    "assets.assist",
    "fan_codes.manage",
    "support.notes",
  ]),
  support_admin: new Set(["support.notes"]),
  creator: new Set([]),
};

export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role].has(permission);
}

export function assertPermission(role: UserRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role ${role} is not allowed to ${permission}`);
  }
}

export function isAdminRole(role: UserRole) {
  return role === "super_admin" || role === "ops_admin" || role === "support_admin";
}
