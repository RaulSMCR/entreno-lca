import Link from "next/link";
import { PwaStatus } from "@/components/PwaStatus";

export default function Home() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Entreno LCA
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Fundaciones del proyecto: PWA instalable y local-first.
          </p>
        </div>

        <PwaStatus />

        <div className="border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <span className="font-medium text-zinc-500 dark:text-zinc-400">
            Supabase configurado:{" "}
          </span>
          {supabaseConfigured ? "sí" : "no (completá .env.local)"}
        </div>

        <Link
          href="/equipos"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Ir a Equipos
        </Link>
      </main>
    </div>
  );
}
