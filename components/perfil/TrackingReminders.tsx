"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { pullRemote } from "@/lib/sync";
import { getTrackingStatuses, type TrackingStatus, type TrackingType } from "@/lib/tracking-cadence";

const PRIORITY: TrackingType[] = ["rm_retest", "inbody_scan", "body_weight"];
const MAX_BANNERS = 2;
const DISMISS_HOURS = 24;

const COPY: Record<TrackingType, { message: string; href: string; cta: string }> = {
  rm_retest: { message: "Es hora de recalibrar tus cargas (1RM).", href: "/calibracion", cta: "Ir a calibración" },
  inbody_scan: { message: "Es hora de tu próximo scan InBody.", href: "/perfil/inbody", cta: "Registrar scan" },
  body_weight: { message: "Es hora de registrar tu peso.", href: "/perfil/peso", cta: "Registrar peso" },
};

function dismissKey(type: TrackingType): string {
  return `tracking-reminder-dismissed-${type}`;
}

function isDismissed(type: TrackingType): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(dismissKey(type));
  if (!raw) return false;
  const dismissedAt = Number(raw);
  return Date.now() - dismissedAt < DISMISS_HOURS * 60 * 60 * 1000;
}

export function TrackingReminders() {
  const [userId, setUserId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<TrackingStatus[]>([]);
  const [, forceRerender] = useState(0);

  function dismiss(type: TrackingType) {
    // Solo se usa como timestamp para localStorage dentro de un click handler,
    // no afecta el output de este render.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    window.localStorage.setItem(dismissKey(type), String(now));
    forceRerender((n) => n + 1);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      setUserId(data.user.id);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        await pullRemote().catch(() => {});
      }
      const result = await getTrackingStatuses(data.user.id);
      if (!cancelled) setStatuses(result);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!userId) return null;

  const due = statuses.filter((s) => (s.urgency === "overdue" || s.urgency === "due_soon") && !isDismissed(s.type));
  const banners = PRIORITY.map((type) => due.find((s) => s.type === type))
    .filter((s): s is TrackingStatus => s != null)
    .slice(0, MAX_BANNERS);

  if (banners.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {banners.map((status) => {
        const copy = COPY[status.type];
        return (
          <div
            key={status.type}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950"
          >
            <span className="text-amber-900 dark:text-amber-100">{copy.message}</span>
            <div className="flex shrink-0 gap-2">
              <Link href={copy.href} className="min-h-11 rounded-lg border border-amber-300 px-3 py-2 font-medium text-amber-900 dark:border-amber-800 dark:text-amber-100">
                Ir ahora
              </Link>
              <button
                type="button"
                onClick={() => dismiss(status.type)}
                className="min-h-11 rounded-lg px-3 py-2 text-amber-900 dark:text-amber-100"
              >
                Después
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
