import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { toTrip } from "@/lib/db/trips";
import { useSession } from "@/session";
import type { Trip } from "@/lib/konvo/types";

/**
 * As viagens da pessoa, com quantos participantes cada uma tem.
 *
 * O RLS ja limita `trips` ao que a pessoa participa, entao nao ha filtro aqui —
 * o banco e a fonte da verdade sobre o que ela pode ver.
 */

export interface TripSummary {
  trip: Trip;
  peopleCount: number;
  vehicleCount: number;
}

export function useMyTrips() {
  const { userId, loading: sessionLoading } = useSession();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);

    // Uma consulta so: as viagens ja trazem os membros embutidos, e a contagem
    // sai daqui. Duas idas ao banco fariam a Home piscar.
    const { data, error: err } = await supabase
      .from("trips")
      .select("*, trip_members(id, transport, riding_with)")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    type Row = Parameters<typeof toTrip>[0] & {
      trip_members: { id: string; transport: string; riding_with: string | null }[];
    };

    setTrips(
      (data as Row[]).map((row) => {
        const members = row.trip_members ?? [];
        return {
          trip: toTrip(row),
          peopleCount: members.length,
          // Veiculos = quem nao esta de carona (ver `isRoadBound` e §07).
          vehicleCount: members.filter((m) => m.riding_with === null).length,
        };
      }),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }
    void load();
  }, [userId, sessionLoading, load]);

  const active = trips.filter((t) => t.trip.status === "active");
  const upcoming = trips.filter((t) => t.trip.status === "upcoming");
  const past = trips.filter((t) => t.trip.status === "completed");

  return { trips, active, upcoming, past, loading, error, reload: load };
}
