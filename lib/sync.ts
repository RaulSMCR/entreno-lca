// Sync single-user, last-write-wins: empuja lo local pendiente y después trae
// lo remoto. Como siempre se empuja antes de traer, no hace falta comparar
// updated_at a mano — si algo sigue _dirty después de empujar (falló el push),
// el pull no lo pisa.

import { createClient } from "@/lib/supabase/client";
import { db, MIRRORED_TABLES, type MirroredTableName } from "@/lib/db";

export type SyncStatus = "offline" | "pending" | "synced" | "syncing" | "error";

function stripLocalMeta<T extends { _dirty?: number; _deleted?: number }>(row: T): Omit<T, "_dirty" | "_deleted"> {
  const clone: Record<string, unknown> = { ...row };
  delete clone._dirty;
  delete clone._deleted;
  return clone as Omit<T, "_dirty" | "_deleted">;
}

async function pushTable(table: MirroredTableName) {
  const supabase = createClient();
  const dirtyRows = await db.table(table).where("_dirty").equals(1).toArray();

  for (const row of dirtyRows) {
    if (row._deleted === 1) {
      const { error } = await supabase.from(table).delete().eq("id", row.id);
      if (error && error.code !== "PGRST116") {
        // PGRST116: no encontrada (ya borrada remotamente) - no es un error real acá.
        throw error;
      }
      await db.table(table).delete(row.id);
      continue;
    }

    const { error } = await supabase.from(table).upsert(stripLocalMeta(row));
    if (error) throw error;
    await db.table(table).update(row.id, { _dirty: 0 });
  }
}

async function pullTable(table: MirroredTableName) {
  const supabase = createClient();
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  if (!data) return;

  const remoteIds = new Set(data.map((r: { id: string }) => r.id));
  await db.transaction("rw", db.table(table), async () => {
    for (const remoteRow of data) {
      const local = await db.table(table).get((remoteRow as { id: string }).id);
      if (local && local._dirty === 1) continue; // push pendiente todavía, no lo piso
      await db.table(table).put({ ...remoteRow, _dirty: 0, _deleted: 0 });
    }

    // Filas que ya no existen remotamente y no tienen cambios locales pendientes:
    // las sacamos del espejo local.
    const localRows = await db.table(table).toArray();
    for (const local of localRows) {
      if (!remoteIds.has(local.id) && local._dirty !== 1) {
        await db.table(table).delete(local.id);
      }
    }
  });
}

export async function pushPending(): Promise<void> {
  for (const table of MIRRORED_TABLES) {
    await pushTable(table);
  }
}

export async function pullRemote(): Promise<void> {
  for (const table of MIRRORED_TABLES) {
    await pullTable(table);
  }
}

export async function syncAll(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  await pushPending();
  await pullRemote();
}

export async function hasPendingChanges(): Promise<boolean> {
  for (const table of MIRRORED_TABLES) {
    const count = await db.table(table).where("_dirty").equals(1).count();
    if (count > 0) return true;
  }
  return false;
}
