"use client";

import { TASK_STATUSES, type MemberDTO, type TaskDTO, type TaskStatus } from "@taskforge/shared";
import { buildBoard, STATUS_LABELS } from "@/lib/board";
import { TaskCard } from "./TaskCard";

interface Props {
  tasks: TaskDTO[];
  members: MemberDTO[];
  canEdit: boolean;
  onMove: (task: TaskDTO, status: TaskStatus) => void;
}

export function Board({ tasks, members, canEdit, onMove }: Props) {
  const board = buildBoard(tasks);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {TASK_STATUSES.map((status) => (
        <section key={status} aria-labelledby={`col-${status}`} className="rounded-xl bg-slate-100 p-3">
          <h2 id={`col-${status}`} className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
            {STATUS_LABELS[status]}
            <span className="rounded-full bg-white px-2 text-xs text-slate-500">{board[status].length}</span>
          </h2>
          <div className="flex flex-col gap-2">
            {board[status].map((t) => (
              <TaskCard key={t.id} task={t} members={members} canEdit={canEdit} onMove={(s) => onMove(t, s)} />
            ))}
            {board[status].length === 0 && <p className="py-6 text-center text-xs text-slate-400">No tasks</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
