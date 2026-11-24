"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { UserDTO } from "@taskforge/shared";

export function Shell({ user, onSignOut, children }: { user?: UserDTO; onSignOut: () => void; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/app" className="font-semibold tracking-tight">
            Task<span className="text-indigo-600">Forge</span>
          </Link>
          {user && (
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span>{user.name}</span>
              <button onClick={onSignOut} className="text-slate-500 hover:text-slate-900">
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
