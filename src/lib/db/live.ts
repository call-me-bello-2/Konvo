/**
 * Sincronia ao vivo da viagem.
 *
 * Duas camadas, de proposito:
 *
 * - BROADCAST para a posicao. Baixa latencia, sem tocar no banco. E o que faz
 *   o pino do outro carro andar suave no mapa.
 * - UPDATE no Postgres a cada ~15 s. E a copia duravel: quem abre o app no meio
 *   da viagem, ou volta de uma area sem sinal, precisa achar todo mundo no
 *   lugar certo sem esperar o proximo broadcast.
 *
 * Mandar toda posicao para o banco seria desperdicio; so broadcast perderia
 * quem chega atrasado. As duas juntas custam pouco e nao deixam buraco.
 */

import { supabase } from "@/lib/supabase";
import { withAuthRetry } from "@/lib/authRecovery";
import { THRESHOLDS as T } from "@/lib/konvo/thresholds";
import { toMember, type MemberRow } from "./trips";
import type { Fix, QuickActionKind, TripMember } from "@/lib/konvo/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PositionBroadcast {
  memberId: string;
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  at: number;
}

interface ConnectOptions {
  tripId: string;
  onPosition: (p: PositionBroadcast) => void;
  /** algo mudou no banco (alguem entrou, parada nova, evento) */
  onChange: () => void;
}

export function connectToTrip({ tripId, onPosition, onChange }: ConnectOptions): {
  channel: RealtimeChannel;
  publish: (memberId: string, fix: Fix) => void;
} {
  const channel = supabase.channel(`trip:${tripId}`, {
    config: { broadcast: { self: false } },
  });

  channel
    .on("broadcast", { event: "position" }, ({ payload }) => {
      onPosition(payload as PositionBroadcast);
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${tripId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_events", filter: `trip_id=eq.${tripId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_stops", filter: `trip_id=eq.${tripId}` },
      onChange,
    )
    .subscribe();

  const publish = (memberId: string, fix: Fix) => {
    void channel.send({
      type: "broadcast",
      event: "position",
      payload: {
        memberId,
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        heading: fix.heading,
        speed: fix.speed,
        at: fix.at,
      } satisfies PositionBroadcast,
    });
  };

  return { channel, publish };
}

// ---------------------------------------------------------------------------
// Escrita duravel
// ---------------------------------------------------------------------------

const lastWrite = new Map<string, number>();

/**
 * Grava a posicao no banco, no maximo uma vez a cada `dbUpsertIntervalMs`.
 *
 * `force` existe para o momento em que a conexao volta: ali a escrita nao pode
 * esperar o proximo intervalo, senao o grupo continua vendo a posicao velha.
 */
export async function persistPosition(
  memberId: string,
  fix: Fix,
  derived: { distanceAlongM: number | null; offRouteM: number | null; state: string },
  force = false,
): Promise<void> {
  const now = Date.now();
  const prev = lastWrite.get(memberId) ?? 0;
  if (!force && now - prev < T.publish.dbUpsertIntervalMs) return;
  lastWrite.set(memberId, now);

  const { error } = await withAuthRetry(async () =>
    supabase
    .from("trip_members")
    .update({
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy,
      heading: fix.heading,
      speed: fix.speed,
      fix_at: new Date(fix.at).toISOString(),
      distance_along_m: derived.distanceAlongM === null ? null : Math.round(derived.distanceAlongM),
      off_route_m: derived.offRouteM === null ? null : Math.round(derived.offRouteM),
      state: derived.state,
      last_seen_at: new Date(now).toISOString(),
    })
      .eq("id", memberId),
  );

  if (error) throw error;
}

export async function refreshMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", tripId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data as MemberRow[]).map(toMember);
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export async function logEvent(
  tripId: string,
  memberId: string | null,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from("trip_events")
    .insert({ trip_id: tripId, member_id: memberId, type, payload });
  if (error) throw error;
}

/** Acao rapida do brief §15 — o que a pessoa toca sem tirar o olho da estrada. */
export async function sendQuickAction(
  tripId: string,
  memberId: string,
  kind: QuickActionKind,
  name: string,
): Promise<void> {
  await logEvent(tripId, memberId, "quick_action", { kind, name });
}

export async function markArrived(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("trip_members")
    .update({ arrived_at: new Date().toISOString(), state: "arrived" })
    .eq("id", memberId);
  if (error) throw error;
}
