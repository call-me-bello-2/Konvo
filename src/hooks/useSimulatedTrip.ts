import { useEffect, useMemo, useRef, useState } from "react";

import fixture from "@/lib/konvo/__fixtures__/sp-ubatuba.json";
import { buildScenario, type ScenarioId } from "@/lib/konvo/simulator";
import { deriveGroupStatus } from "@/lib/konvo/groupStatus";
import { createDeriveContext, deriveMembers } from "@/lib/konvo/memberState";
import { routeFromPolyline } from "@/lib/konvo/route";
import { deriveVehicles } from "@/lib/konvo/vehicles";
import type { Trip } from "@/lib/konvo/types";

/**
 * Viagem simulada, com a mesma forma de `useLiveTrip`.
 *
 * Serve para dois usos que se confundem mas nao sao o mesmo:
 * - mostrar o produto funcionando antes do banco existir;
 * - inspecionar cada estado do grupo sob demanda, que na estrada so acontece
 *   por acaso.
 *
 * Toda a derivacao passa pelas MESMAS funcoes do modo real. O simulador so
 * inventa posicao.
 */

const TICK_MS = 1000;
/** Fracao da rota por segundo — o suficiente para ver os pinos andarem. */
const SPEED = 0.00012;

export function useSimulatedTrip(enabled: boolean, scenario: ScenarioId, playing: boolean) {
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const ctxRef = useRef<ReturnType<typeof createDeriveContext> | null>(null);

  const route = useMemo(() => routeFromPolyline(fixture.polyline), []);

  useEffect(() => {
    if (!enabled) return;
    ctxRef.current = createDeriveContext(route, fixture.destination, fixture.durationS);
  }, [enabled, route]);

  // Trocar de cenario recomeca do zero: senao o grupo aparece no meio do mapa
  // sem contexto de onde saiu.
  useEffect(() => setProgress(0), [scenario]);

  useEffect(() => {
    if (!enabled || !playing) return;
    const id = setInterval(() => {
      setProgress((p) => Math.min(0.6, p + SPEED));
      setNow(Date.now());
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, playing]);

  const derived = useMemo(() => {
    if (!enabled || !ctxRef.current) {
      return { members: [], vehicles: [], status: null };
    }

    const ctx = ctxRef.current;
    ctx.now = now;

    const raw = buildScenario(scenario, route, progress, now);
    const members = deriveMembers(raw, ctx);
    const vehicles = deriveVehicles(members);

    return { members, vehicles, status: deriveGroupStatus({ members: vehicles }) };
  }, [enabled, scenario, progress, now, route]);

  const trip: Trip = useMemo(
    () => ({
      id: "demo",
      code: "DEMO01",
      name: fixture.destination.name.split(",")[0],
      mode: "together" as const,
      status: "active" as const,
      destination: fixture.destination,
      origin: fixture.origin,
      meeting: null,
      meetAt: null,
      routePolyline: fixture.polyline,
      routeDistanceM: fixture.distanceM,
      routeDurationS: fixture.durationS,
      createdBy: "demo",
      startsAt: null,
      startedAt: null,
      endedAt: null,
    }),
    [],
  );

  return {
    trip,
    route,
    me: derived.members[0] ?? null,
    members: derived.members,
    vehicles: derived.vehicles,
    status: derived.status,
    transition: null,
    myFix: derived.members[0]?.fix ?? null,
    permission: "granted" as const,
    geoError: null,
    wakeLock: { active: false, supported: true },
    online: true,
    queued: 0,
    loading: false,
    error: null,
    progress,
    setProgress,
    reload: () => {},
  };
}
