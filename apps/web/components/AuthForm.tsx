"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, session } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const value = (k: string) => String(form.get(k) ?? "");
    try {
      const res =
        mode === "login"
          ? await api.login({ email: value("email"), password: value("password") })
          : await api.register({
              email: value("email"),
              password: value("password"),
              name: value("name"),
              organizationName: value("organizationName"),
            });
      session.set(res.token);
      router.push("/app");
    } catch (err) {
      const issues = err instanceof ApiError ? err.problem.issues : undefined;
      setError(issues?.length ? issues.map((i) => i.message).join(". ") : (err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const field = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">{mode === "login" ? "Sign in to TaskForge" : "Create your workspace"}</h1>
        {mode === "register" && (
          <>
            <input className={field} name="name" placeholder="Your name" required />
            <input className={field} name="organizationName" placeholder="Organization name" required />
          </>
        )}
        <input className={field} name="email" type="email" placeholder="Email" autoComplete="email" required />
        <input
          className={field}
          name="password"
          type="password"
          placeholder="Password (10+ characters)"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          disabled={pending}
          className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-500">
          {mode === "login" ? (
            <Link href="/register">No account? Register</Link>
          ) : (
            <Link href="/login">Have an account? Sign in</Link>
          )}
        </p>
      </form>
    </main>
  );
}
