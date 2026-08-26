/**
 * Acesso a dados de viagem.
 *
 * Tudo que sai do banco e convertido para os tipos de `lib/konvo/types` aqui —
 * nenhum componente ve `snake_case` nem linha crua do Postgres.
 */

import { supabase } from "@/lib/supabase";
import type {
  LatLng,
  TransportType,
  Trip,
  TripMember,
  TripMode,
  TripStatus,
} from "@/lib/konvo/types";

// ---------------------------------------------------------------------------
// Linhas do banco
// ---------------------------------------------------------------------------

interface TripRow {
  id: string;
  code: string;
  name: string;
  mode: TripMode;
  status: TripStatus;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  origin_lat: number | null;
  origin_lng: number | null;
  route_polyline: string | null;
  route_distance_m: number | null;
  route_duration_s: number | null;
  created_by: string;
  starts_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface MemberRow {
  id: string;
  trip_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  color_index: number;
  transport: TransportType;
  is_leader: boolean;
  riding_with: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  fix_at: string | null;
  distance_along_m: number | null;
  off_route_m: number | null;
  arrived_at: string | null;
  last_seen_at: string | null;
}

// ---------------------------------------------------------------------------
// Conversao
// ---------------------------------------------------------------------------

export function toTrip(r: TripRow): Trip {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    mode: r.mode,
    status: r.status,
    destination: {
      name: r.destination_name,
      lat: r.destination_lat,
      lng: r.destination_lng,
    },
    origin: r.origin_lat !== null && r.origin_lng !== null
      ? { lat: r.origin_lat, lng: r.origin_lng }
      : null,
    routePolyline: r.route_polyline,
    routeDistanceM: r.route_distance_m,
    routeDurationS: r.route_duration_s,
    createdBy: r.created_by,
    startsAt: r.starts_at,
    startedAt: r.started_at,
    endedAt: r.ended_at,
  };
}

export function toMember(r: MemberRow): TripMember {
  const fixAt = r.fix_at ? Date.parse(r.fix_at) : null;

  return {
    id: r.id,
    tripId: r.trip_id,
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    colorIndex: r.color_index,
    transport: r.transport,
    isLeader: r.is_leader,
    ridingWith: r.riding_with,
    fix:
      r.lat !== null && r.lng !== null && fixAt !== null
        ? {
            lat: r.lat,
            lng: r.lng,
            accuracy: r.accuracy ?? 0,
            heading: r.heading,
            speed: r.speed,
            at: fixAt,
          }
        : null,
    distanceAlongM: r.distance_along_m,
    offRouteM: r.off_route_m,
    arrivedAt: r.arrived_at,
    lastSeenAt: r.last_seen_at ? Date.parse(r.last_seen_at) : null,
  };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function getTrip(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (error) throw error;
  return data ? toTrip(data as TripRow) : null;
}

export async function getMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", tripId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data as MemberRow[]).map(toMember);
}

/** Viagens de que a pessoa participa, para a Home e a aba Trips. */
export async function listMyTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as TripRow[]).map(toTrip);
}

export interface TripPreview {
  tripId: string;
  name: string;
  mode: TripMode;
  status: TripStatus;
  destinationName: string;
  startsAt: string | null;
  memberCount: number;
  hostName: string | null;
  alreadyMember: boolean;
}

/**
 * Previa do convite.
 *
 * Quem recebeu o link ainda nao e membro, entao nao passa pelo RLS de `trips` —
 * por isso vai por RPC `SECURITY DEFINER`, que devolve so o que a tela de
 * convite precisa e nunca a posicao de ninguem.
 */
export async function getTripPreview(code: string): Promise<TripPreview | null> {
  const { data, error } = await supabase.rpc("get_trip_preview", { p_code: code });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    tripId: row.trip_id,
    name: row.name,
    mode: row.mode,
    status: row.status,
    destinationName: row.destination_name,
    startsAt: row.starts_at,
    memberCount: Number(row.member_count),
    hostName: row.host_name,
    alreadyMember: row.already_member,
  };
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export interface CreateTripInput {
  name: string;
  mode: TripMode;
  destination: LatLng & { name: string };
  origin: LatLng | null;
  displayName: string;
  transport: TransportType;
  route: { polyline: string | null; distanceM: number; durationS: number } | null;
  /** null = comeca agora */
  startsAt: string | null;
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const { data, error } = await supabase.rpc("create_trip", {
    p_name: input.name,
    p_mode: input.mode,
    p_destination_name: input.destination.name,
    p_destination_lat: input.destination.lat,
    p_destination_lng: input.destination.lng,
    p_display_name: input.displayName,
    p_transport: input.transport,
    p_origin_lat: input.origin?.lat ?? null,
    p_origin_lng: input.origin?.lng ?? null,
    p_route_polyline: input.route?.polyline ?? null,
    p_route_distance_m: input.route?.distanceM ?? null,
    p_route_duration_s: input.route?.durationS ?? null,
    p_starts_at: input.startsAt,
  });
  if (error) throw error;
  return toTrip((Array.isArray(data) ? data[0] : data) as TripRow);
}

export async function joinTrip(input: {
  code: string;
  displayName: string;
  transport: TransportType;
  avatarUrl?: string | null;
  /** id do membro que conduz, quando a pessoa entra como passageiro */
  ridingWith?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("join_trip", {
    p_code: input.code,
    p_display_name: input.displayName,
    p_transport: input.transport,
    p_avatar_url: input.avatarUrl ?? null,
    p_riding_with: input.ridingWith ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function startTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from("trips")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", tripId);
  if (error) throw error;
}

export async function completeTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from("trips")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", tripId);
  if (error) throw error;
}
