import Link from "next/link";
import { PwaStatus } from "@/components/PwaStatus";
import { PwaInstallButton } from "@/components/PwaInstallButton";
import { TrackingReminders } from "@/components/perfil/TrackingReminders";

export default function Home() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6">
      <main className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Cultiva
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Mente sana en cuerpo sano.
          </p>
        </div>

        <PwaStatus />
        <PwaInstallButton />

        <TrackingReminders />

        <div className="border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <span className="font-medium text-zinc-500 dark:text-zinc-400">
            Supabase configurado:{" "}
          </span>
          {supabaseConfigured ? "sí" : "no (completá .env.local)"}
        </div>

        <Link
          href="/perfil"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
        >
          Perfil
        </Link>
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/equipos"
            className="rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white"
          >
            Equipos
          </Link>
          <Link
            href="/ejercicios"
            className="rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white"
          >
            Ejercicios
          </Link>
          <Link
            href="/plantillas"
            className="rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white"
          >
            Plantillas
          </Link>
        </div>
        <Link
          href="/semana"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
        >
          Ir a Semana
        </Link>
        <Link
          href="/entrenar"
          className="rounded-lg bg-accent-600 px-4 py-3 text-center text-base font-semibold text-brand-950"
        >
          Entrenar
        </Link>
        <Link
          href="/progreso"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
        >
          Ver progreso
        </Link>
      </main>
    </div>
  );
}
