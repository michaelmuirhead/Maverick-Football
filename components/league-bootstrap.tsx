"use client";
import { useEffect } from "react";
import { useLeague } from "@/lib/store/league";

export function LeagueBootstrap() {
  const hydrate = useLeague((s) => s.hydrate);
  const hydrated = useLeague((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrate, hydrated]);
  return null;
}
