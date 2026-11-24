"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { MemberDTO, TaskDTO, TaskStatus } from "@taskforge/shared";
import { Board } from "@/components/Board";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";
import { applyUpdate, progress } from "@/lib/board";
import { useSession } from "@/lib/useSession";

export default function ProjectPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { user, organizations, signOut } = useSession();
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  const role = organizations?.find((o) => o.id === orgId)?.role;
  const canEdit = role !== undefined && role !== "viewer";

  useEffect(() => {
    Promise.all([api.tasks(orgId, projectId), api.members(orgId)])
      .then(([t, m]) => {
        setTasks(t.data);
        setMembers(m.data);
      })
      .catch((e: Error) => setError(e.message));
  }, [orgId, projectId]);

  const move = useCallback(
    async (task: TaskDTO, status: TaskStatus) => {
      const previous = tasks;
      setTasks(applyUpdate(tasks, { ...task, status })); // optimistic
      try {
        const updated = await api.updateTask(orgId, task.id, { status });
        setTasks((cur) => applyUpdate(cur, updated));
      } catch (e) {
        setTasks(previous);
        setError((e as Error).message);
      }
    },
    [orgId, tasks],
  );

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const title = String(new FormData(form).get("title"));
    const task = await api.createTask(orgId, projectId, { title });
    setTasks((cur) => [...cur, task]);
    form.reset();
  }

  return (
    <Shell user={user} onSignOut={signOut}>
      <Link href="/app" className="text-sm text-slate-500 hover:text-slate-900">
        ← Projects
      </Link>
      <div className="mt-2 mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Board</h1>
        <span className="text-sm text-slate-500">{progress(tasks)}% done</span>
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      {canEdit && (
        <form onSubmit={create} className="mb-6 flex gap-2">
          <input name="title" required placeholder="What needs to be done?" className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">Add task</button>
        </form>
      )}
      <Board tasks={tasks} members={members} canEdit={canEdit} onMove={move} />
    </Shell>
  );
}
