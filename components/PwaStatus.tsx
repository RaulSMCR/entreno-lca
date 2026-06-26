"use client";

import { useEffect, useState } from "react";

export function PwaStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [swReady, setSwReady] = useState(false);
  const [standalone] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(display-mode: standalone)").matches
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => setSwReady(true));
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
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
