import type { Role } from "@taskforge/shared";

/** Identity and tenant resolved for a request scoped to one organization. */
export interface TenantContext {
  userId: string;
  orgId: string;
  role: Role;
}
