"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const STANDALONE_QUERY = "(display-mode: standalone)";

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

function subscribeStandalone(onStoreChange: () => void) {
  const displayMode = window.matchMedia(STANDALONE_QUERY);
  displayMode.addEventListener("change", onStoreChange);
  return () => displayMode.removeEventListener("change", onStoreChange);
}

function getStandaloneSnapshot() {
  return window.matchMedia(STANDALONE_QUERY).matches;
}

function getServerStandaloneSnapshot() {
  return false;
}

export function PwaStatus() {
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );
  const [swReady, setSwReady] = useState(false);
  const standalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getServerStandaloneSnapshot
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => setSwReady(true))
      .catch(() => setSwReady(false));
  }, []);

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="font-medium text-zinc-500 dark:text-zinc-400">Conexión</dt>
      <dd>{online ? "En línea" : "Sin conexión (offline)"}</dd>

      <dt className="font-medium text-zinc-500 dark:text-zinc-400">Service worker</dt>
      <dd>{swReady ? "Activo" : "Registrando…"}</dd>

      <dt className="font-medium text-zinc-500 dark:text-zinc-400">Modo</dt>
      <dd>{standalone ? "Instalada (standalone)" : "Navegador"}</dd>
    </dl>
  );
}
