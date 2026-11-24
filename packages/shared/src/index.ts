/**
 * Contracts shared by the API and the web app. The API validates every request
 * with these schemas and the web app uses the same types, so a change to a
 * payload is a compile error on both sides.
 */
import { z } from "zod";

export const ROLES = ["owner", "admin", "member", "viewer"] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export const TaskStatus = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TaskPriority = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof TaskPriority>;

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const password = z.string().min(10, "Password must be at least 10 characters").max(200);
const uuid = z.uuid();

export const RegisterInput = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(100),
  organizationName: z.string().trim().min(2).max(100),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({ email, password: z.string().min(1).max(200) });
export type LoginInput = z.infer<typeof LoginInput>;

export const AddMemberInput = z.object({ email, role: Role.exclude(["owner"]) });
export type AddMemberInput = z.infer<typeof AddMemberInput>;

export const ChangeRoleInput = z.object({ role: Role.exclude(["owner"]) });
export type ChangeRoleInput = z.infer<typeof ChangeRoleInput>;

export const CreateProjectInput = z.object({
  name: z.string().trim().min(1).max(100),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, "Key must be 2-10 letters or digits, starting with a letter"),
  description: z.string().trim().max(2000).default(""),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const CreateTaskInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).default(""),
  priority: TaskPriority.default("medium"),
  assigneeId: uuid.nullable().default(null),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000),
    status: TaskStatus,
    priority: TaskPriority,
    assigneeId: uuid.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const TaskFilter = z.object({
  status: TaskStatus.optional(),
  assigneeId: uuid.optional(),
});
export type TaskFilter = z.infer<typeof TaskFilter>;

export interface UserDTO {
  id: string;
  email: string;
  name: string;
}

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

export interface MemberDTO extends UserDTO {
  role: Role;
}

export interface ProjectDTO {
  id: string;
  key: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface TaskDTO {
  id: string;
  projectId: string;
  /** Human-friendly identifier such as WEB-42. */
  ref: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
  organizations: OrganizationDTO[];
}

export interface ProblemDTO {
  error: string;
  message: string;
  issues?: { path: string; message: string }[];
}
