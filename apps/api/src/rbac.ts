import type { Role } from "@taskforge/shared";
import { forbidden } from "./errors.js";

/**
 * Permission matrix. Keeping it as data (rather than scattered role checks)
 * makes the policy reviewable in one place and testable exhaustively.
 */
export const PERMISSIONS = {
  "org:read": ["owner", "admin", "member", "viewer"],
  "members:manage": ["owner", "admin"],
  "members:grant-admin": ["owner"],
  "project:create": ["owner", "admin"],
  "task:write": ["owner", "admin", "member"],
  "task:delete": ["owner", "admin"],
  "audit:read": ["owner", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw forbidden(`Role "${role}" lacks permission "${permission}"`);
}
