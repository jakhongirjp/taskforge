import type {
  AuthResponse,
  CreateProjectInput,
  CreateTaskInput,
  LoginInput,
  MemberDTO,
  OrganizationDTO,
  ProblemDTO,
  ProjectDTO,
  RegisterInput,
  TaskDTO,
  UpdateTaskInput,
  UserDTO,
} from "@taskforge/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "taskforge.token";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDTO,
  ) {
    super(problem.message);
  }
}

export const session = {
  get: () => (typeof window === "undefined" ? null : window.sessionStorage.getItem(TOKEN_KEY)),
  set: (token: string) => window.sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => window.sessionStorage.removeItem(TOKEN_KEY),
};

type Fetcher = typeof fetch;

/** Typed client for the TaskForge API. `fetcher` is injectable for tests. */
export function createClient(fetcher: Fetcher = (...a) => fetch(...a), getToken = session.get) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetcher(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({ error: "invalid_response", message: res.statusText }));
    if (!res.ok) throw new ApiError(res.status, data as ProblemDTO);
    return data as T;
  }

  const org = (orgId: string) => `/orgs/${encodeURIComponent(orgId)}`;
  return {
    register: (input: RegisterInput) => request<AuthResponse>("POST", "/auth/register", input),
    login: (input: LoginInput) => request<AuthResponse>("POST", "/auth/login", input),
    me: () => request<{ user: UserDTO; organizations: OrganizationDTO[] }>("GET", "/me"),
    members: (orgId: string) => request<{ data: MemberDTO[] }>("GET", `${org(orgId)}/members`),
    projects: (orgId: string) => request<{ data: ProjectDTO[] }>("GET", `${org(orgId)}/projects`),
    createProject: (orgId: string, input: Omit<CreateProjectInput, "description"> & { description?: string }) =>
      request<ProjectDTO>("POST", `${org(orgId)}/projects`, input),
    tasks: (orgId: string, projectId: string) =>
      request<{ data: TaskDTO[] }>("GET", `${org(orgId)}/projects/${projectId}/tasks`),
    createTask: (orgId: string, projectId: string, input: Partial<CreateTaskInput> & { title: string }) =>
      request<TaskDTO>("POST", `${org(orgId)}/projects/${projectId}/tasks`, input),
    updateTask: (orgId: string, taskId: string, input: UpdateTaskInput) =>
      request<TaskDTO>("PATCH", `${org(orgId)}/tasks/${taskId}`, input),
    deleteTask: (orgId: string, taskId: string) => request<void>("DELETE", `${org(orgId)}/tasks/${taskId}`),
  };
}

export type ApiClient = ReturnType<typeof createClient>;
export const api = createClient();
