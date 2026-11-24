import type { TaskDTO } from "@taskforge/shared";

export function task(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: crypto.randomUUID(),
    projectId: "p",
    ref: "WEB-1",
    title: "Task",
    description: "",
    status: "todo",
    priority: "medium",
    assigneeId: null,
    createdBy: "u",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
