"use client";

import { TASK_STATUSES, type MemberDTO, type TaskDTO, type TaskStatus } from "@taskforge/shared";
import { STATUS_LABELS } from "@/lib/board";

const PRIORITY_STYLES: Record<TaskDTO["priority"], string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-sky-100 text-sky-700",
  low: "bg-slate-100 text-slate-600",
};

interface Props {
  task: TaskDTO;
  members: MemberDTO[];
  canEdit: boolean;
  onMove: (status: TaskStatus) => void;
}

export function TaskCard({ task, members, canEdit, onMove }: Props) {
  const assignee = members.find((m) => m.id === task.assigneeId);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" aria-label={`${task.ref} ${task.title}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-mono text-slate-500">{task.ref}</span>
        <span className={`rounded px-1.5 py-0.5 font-medium ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
      </div>
      <h3 className="mt-1.5 text-sm font-medium text-slate-900">{task.title}</h3>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{assignee ? assignee.name : "Unassigned"}</span>
        {canEdit && (
          <label className="sr-only" htmlFor={`move-${task.id}`}>
            Move {task.ref}
          </label>
        )}
        {canEdit && (
          <select
            id={`move-${task.id}`}
            className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5"
            value={task.status}
            onChange={(e) => onMove(e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}
      </div>
    </article>
  );
}
