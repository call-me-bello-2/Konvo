import { supabase } from "@/lib/supabase";
import { withAuthRetry } from "@/lib/authRecovery";
import type { Checkpoint } from "@/lib/konvo/checkpoints";
import type { LatLng } from "@/lib/konvo/types";

/**
 * Checkpoints no banco.
 *
 * A deteccao de chegada roda no cliente (ver `lib/konvo/checkpoints.ts`); aqui
 * so ficam a leitura, a criacao e o registro de quem passou.
 */

interface CheckpointRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  at_distance_m: number | null;
  radius_m: number;
}

function toCheckpoint(r: CheckpointRow): Checkpoint {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    atDistanceM: r.at_distance_m,
    radiusM: r.radius_m,
  };
}

export async function listCheckpoints(tripId: string): Promise<Checkpoint[]> {
  const { data, error } = await supabase
    .from("trip_checkpoints")
    .select("*")
    .eq("trip_id", tripId)
    .order("at_distance_m", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data as CheckpointRow[]).map(toCheckpoint);
}

export async function addCheckpoint(
  tripId: string,
  place: LatLng & { name: string },
  atDistanceM: number | null,
): Promise<Checkpoint> {
  const { data, error } = await withAuthRetry(async () =>
    supabase
      .from("trip_checkpoints")
      .insert({
        trip_id: tripId,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        at_distance_m: atDistanceM === null ? null : Math.round(atDistanceM),
      })
      .select()
      .single(),
  );
  if (error) throw error;
  return toCheckpoint(data as CheckpointRow);
}

export async function removeCheckpoint(id: string): Promise<void> {
  const { error } = await supabase.from("trip_checkpoints").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Quem ja passou por cada checkpoint.
 *
 * Devolve um Map de checkpoint -> conjunto de membros, que e a forma que
 * `deriveCheckpoints` consome.
 */
export async function listArrivals(tripId: string): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabase
    .from("checkpoint_arrivals")
    .select("checkpoint_id, member_id, trip_checkpoints!inner(trip_id)")
    .eq("trip_checkpoints.trip_id", tripId);
  if (error) throw error;

  const map = new Map<string, Set<string>>();
  for (const row of (data as { checkpoint_id: string; member_id: string }[]) ?? []) {
    const set = map.get(row.checkpoint_id) ?? new Set<string>();
    set.add(row.member_id);
    map.set(row.checkpoint_id, set);
  }
  return map;
}

/**
 * Registra a propria chegada.
 *
 * `upsert` com `ignoreDuplicates` porque a deteccao roda a cada posicao: quem
 * fica dez minutos no posto dispararia dezenas de gravacoes. A chave primaria
 * (checkpoint, membro) ja garante uma so — isto evita o erro de conflito.
 */
export async function registerArrival(
  checkpointId: string,
  memberId: string,
): Promise<void> {
  await supabase
    .from("checkpoint_arrivals")
    .upsert({ checkpoint_id: checkpointId, member_id: memberId }, { ignoreDuplicates: true })
    .then(() => undefined);
}
