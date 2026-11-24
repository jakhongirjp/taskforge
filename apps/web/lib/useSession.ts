"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationDTO, UserDTO } from "@taskforge/shared";
import { api, ApiError, session } from "./api";

/** Loads the signed-in user, redirecting to /login when there is no valid session. */
export function useSession() {
  const router = useRouter();
  const [state, setState] = useState<{ user: UserDTO; organizations: OrganizationDTO[] } | null>(null);

  useEffect(() => {
    if (!session.get()) {
      router.replace("/login");
      return;
    }
    api
      .me()
      .then(setState)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          session.clear();
          router.replace("/login");
        }
      });
  }, [router]);

  const signOut = () => {
    session.clear();
    router.replace("/login");
  };
  return { ...state, signOut };
}
