"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ProjectDTO } from "@taskforge/shared";
import { Shell } from "@/components/Shell";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export default function WorkspacePage() {
  const { user, organizations, signOut } = useSession();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  const org = organizations?.find((o) => o.id === orgId) ?? organizations?.[0];
  const canCreate = org?.role === "owner" || org?.role === "admin";

  useEffect(() => {
    if (!org) return;
    api.projects(org.id).then((r) => setProjects(r.data));
  }, [org]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!org) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const p = await api.createProject(org.id, { name: String(data.get("name")), key: String(data.get("key")) });
      setProjects((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
      form.reset();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? (err.problem.issues?.[0]?.message ?? err.message) : String(err));
    }
  }

  return (
    <Shell user={user} onSignOut={signOut}>
      {organizations && organizations.length > 1 && (
        <select className="mb-6 rounded border px-2 py-1 text-sm" value={org?.id} onChange={(e) => setOrgId(e.target.value)}>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{org?.name ?? "Loading…"}</h1>
        {org && <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{org.role}</span>}
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/app/${org!.id}/${p.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow"
            >
              <span className="font-mono text-xs text-slate-500">{p.key}</span>
              <h2 className="mt-1 font-medium">{p.name}</h2>
            </Link>
          </li>
        ))}
        {projects.length === 0 && org && <li className="text-sm text-slate-500">No projects yet.</li>}
      </ul>

      {canCreate && (
        <form onSubmit={create} className="mt-8 flex flex-wrap items-center gap-2">
          <input name="name" placeholder="Project name" required className="rounded-md border px-3 py-2 text-sm" />
          <input name="key" placeholder="KEY" required maxLength={10} className="w-24 rounded-md border px-3 py-2 font-mono text-sm uppercase" />
          <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">New project</button>
          {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
    </Shell>
  );
}
