"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, MIRRORED_TABLES } from "@/lib/db";
import { syncAll } from "@/lib/sync";

type Status = "offline" | "syncing" | "pending" | "synced";

const LABEL: Record<Status, string> = {
  offline: "Offline",
  syncing: "Sincronizando…",
  pending: "Pendiente de sincronizar",
  synced: "Sincronizado",
};

const DOT: Record<Status, string> = {
  offline: "bg-zinc-400",
  syncing: "bg-amber-400 animate-pulse",
  pending: "bg-amber-500",
  synced: "bg-emerald-500",
};

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

export function SyncStatus() {
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );
  const [syncing, setSyncing] = useState(false);

  const pendingCount = useLiveQuery(async () => {
    const counts = await Promise.all(MIRRORED_TABLES.map((t) => db.table(t).where("_dirty").equals(1).count()));
    return counts.reduce((a, b) => a + b, 0);
  }, [], 0);

  useEffect(() => {
    const goOnline = async () => {
      setSyncing(true);
      try {
        await syncAll();
      } finally {
        setSyncing(false);
      }
    };
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("online", goOnline);
    };
  }, []);

  let status: Status;
  if (!online) status = "offline";
  else if (syncing) status = "syncing";
  else if ((pendingCount ?? 0) > 0) status = "pending";
  else status = "synced";

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
      {(pendingCount ?? 0) > 0 && status !== "offline" && ` (${pendingCount})`}
    </div>
  );
}
