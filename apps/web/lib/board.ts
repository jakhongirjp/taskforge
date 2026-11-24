import { TASK_STATUSES, type TaskDTO, type TaskPriority, type TaskStatus } from "@taskforge/shared";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export type Board = Record<TaskStatus, TaskDTO[]>;

/** Groups tasks into columns, most urgent first, then oldest ref first. */
export function buildBoard(tasks: TaskDTO[]): Board {
  const board = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as TaskDTO[]])) as Board;
  for (const t of tasks) board[t.status].push(t);
  for (const s of TASK_STATUSES) {
    board[s].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || refNumber(a) - refNumber(b));
  }
  return board;
}

const refNumber = (t: TaskDTO) => Number(t.ref.split("-").at(-1));

/** Returns a new task list with one task replaced, for optimistic updates. */
export function applyUpdate(tasks: TaskDTO[], updated: TaskDTO): TaskDTO[] {
  return tasks.map((t) => (t.id === updated.id ? updated : t));
}

export function progress(tasks: TaskDTO[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
}
