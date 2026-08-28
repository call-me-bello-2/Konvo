import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { connectToTrip, persistPosition, refreshMembers, type PositionBroadcast } from "@/lib/db/live";
import { getMembers, getTrip } from "@/lib/db/trips";
import { deriveGroupStatus, detectTransition } from "@/lib/konvo/groupStatus";
import { createDeriveContext, deriveMembers, type DeriveContext } from "@/lib/konvo/memberState";
import { routeFromPolyline, straightLineRoute, type Route } from "@/lib/konvo/route";
import { deriveVehicles } from "@/lib/konvo/vehicles";
import { useWatchPosition } from "@/lib/geo/useWatchPosition";
import { useWakeLock } from "@/lib/geo/useWakeLock";
import { clearQueue, drain, enqueue, queueSize } from "@/lib/geo/positionQueue";
import { useSession } from "@/session";
import type { Fix, GroupStatus, Trip, TripMember } from "@/lib/konvo/types";

/**
 * O estado ao vivo de uma viagem.
 *
 * Junta tudo: o que veio do banco, o GPS do proprio aparelho, o realtime dos
 * outros, e a derivacao do nucleo logico. A tela do Live so desenha o que sai
 * daqui — nao calcula nada.
 */

export function useLiveTrip(tripId: string | undefined) {
  const { userId } = useSession();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  // Posicoes que chegaram por broadcast e ainda nao estao na copia do banco.
  const [liveFixes, setLiveFixes] = useState<Record<string, Fix>>({});

  /** ate quando a propria localizacao esta pausada (epoch ms) */
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);

  const publishRef = useRef<((memberId: string, fix: Fix) => void) | null>(null);
  const ctxRef = useRef<DeriveContext | null>(null);
  const prevStatus = useRef<GroupStatus | null>(null);

  const me = useMemo(
    () => members.find((m) => m.userId === userId) ?? null,
    [members, userId],
  );

  // --- carga inicial -------------------------------------------------------

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    setLoading(true);
    Promise.all([getTrip(tripId), getMembers(tripId)])
      .then(([t, m]) => {
        if (cancelled) return;
        setTrip(t);
        setMembers(m);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  // --- rota ----------------------------------------------------------------

  const route: Route | null = useMemo(() => {
    if (!trip) return null;
    if (trip.routePolyline) return routeFromPolyline(trip.routePolyline);
    // Sem polyline (a OSRM falhou na criacao): linha reta. Degradado nas
    // distancias, mas toda a logica de grupo continua valendo.
    if (trip.origin) return straightLineRoute(trip.origin, trip.destination);
    return null;
  }, [trip]);

  useEffect(() => {
    if (!route || !trip) return;
    ctxRef.current = createDeriveContext(route, trip.destination, trip.routeDurationS);
  }, [route, trip]);

  // --- realtime ------------------------------------------------------------

  useEffect(() => {
    if (!tripId) return;

    const onPosition = (p: PositionBroadcast) => {
      setLiveFixes((prev) => ({
        ...prev,
        [p.memberId]: {
          lat: p.lat,
          lng: p.lng,
          accuracy: p.accuracy,
          heading: p.heading,
          speed: p.speed,
          at: p.at,
        },
      }));
    };

    const onChange = () => {
      void refreshMembers(tripId).then(setMembers).catch(() => {});
    };

    const { channel, publish } = connectToTrip({ tripId, onPosition, onChange });
    publishRef.current = publish;

    return () => {
      publishRef.current = null;
      void channel.unsubscribe();
    };
  }, [tripId]);

  // --- conexao -------------------------------------------------------------

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // --- publicacao da propria posicao ---------------------------------------

  const publishFix = useCallback(
    async (fix: Fix) => {
      if (!tripId || !me || !ctxRef.current) return;

      // Localizacao pausada: nao publica nada. Nem broadcast, nem banco, nem
      // fila — guardar para mandar depois derrotaria o proposito da pausa.
      if (pausedUntil && Date.now() < pausedUntil) return;

      // O broadcast e barato e sem estado: manda sempre, mesmo offline (falha
      // silenciosa) — o que nao pode falhar e a fila abaixo.
      publishRef.current?.(me.id, fix);

      const ctx = ctxRef.current;
      const [derived] = deriveMembers([{ ...me, fix, lastSeenAt: fix.at }], ctx);

      try {
        if (!navigator.onLine) throw new Error("offline");
        await persistPosition(me.id, fix, {
          distanceAlongM: derived.distanceAlongM,
          offRouteM: derived.offRouteM,
          state: derived.state,
        });
      } catch {
        // Zona morta de sinal: guarda para mandar quando voltar. Sem isto a
        // trilha do recap fica furada e a ultima posicao conhecida envelhece
        // sem ninguem saber por que.
        await enqueue({
          tripId,
          memberId: me.id,
          lat: fix.lat,
          lng: fix.lng,
          accuracy: fix.accuracy,
          heading: fix.heading,
          speed: fix.speed,
          at: fix.at,
        }).catch(() => {});
        void queueSize().then(setQueued).catch(() => {});
      }
    },
    [tripId, me, pausedUntil],
  );

  const isActive = trip?.status === "active";
  const { fix: myFix, permission, error: geoError } = useWatchPosition({
    enabled: Boolean(isActive && me),
    onPublish: (f) => void publishFix(f),
  });
  const wakeLock = useWakeLock(Boolean(isActive && me));

  // --- drenar a fila quando o sinal volta ----------------------------------

  useEffect(() => {
    if (!online || !me || !ctxRef.current) return;

    void (async () => {
      const pending = await drain().catch(() => []);
      if (pending.length === 0) return;

      // So a ultima posicao interessa para o "onde esta agora"; as anteriores
      // ja passaram. Mandar todas em sequencia so atrasaria a atualizacao.
      const last = pending[pending.length - 1];
      const fix: Fix = {
        lat: last.lat,
        lng: last.lng,
        accuracy: last.accuracy,
        heading: last.heading,
        speed: last.speed,
        at: last.at,
      };
      const [derived] = deriveMembers([{ ...me, fix, lastSeenAt: fix.at }], ctxRef.current!);

      await persistPosition(
        me.id,
        fix,
        {
          distanceAlongM: derived.distanceAlongM,
          offRouteM: derived.offRouteM,
          state: derived.state,
        },
        true,
      ).catch(() => {});

      await clearQueue().catch(() => {});
      setQueued(0);
    })();
  }, [online, me]);

  // --- derivacao -----------------------------------------------------------

  const derived = useMemo(() => {
    if (!route || !trip || !ctxRef.current) {
      return { members: [], vehicles: [], status: null as GroupStatus | null };
    }

    const ctx = ctxRef.current;
    ctx.now = Date.now();

    // A posicao mais fresca vence: broadcast do outro carro chega antes da
    // copia do banco, e a propria leitura do GPS chega antes das duas.
    const merged = members.map((m) => {
      const live = liveFixes[m.id];
      const own = m.userId === userId ? myFix : null;
      const best = [m.fix, live, own]
        .filter((f): f is Fix => Boolean(f))
        .sort((a, b) => b.at - a.at)[0];

      return best
        ? { ...m, fix: best, lastSeenAt: Math.max(m.lastSeenAt ?? 0, best.at) }
        : m;
    });

    const dm = deriveMembers(merged, ctx);
    const vehicles = deriveVehicles(dm);
    // O grupo se move em VEICULOS: dois passageiros do mesmo carro nunca se
    // dividem, e contar o motorista como "sem sinal" enquanto o passageiro do
    // lado transmite seria falso.
    const status = deriveGroupStatus({ members: vehicles });

    return { members: dm, vehicles, status };
  }, [members, liveFixes, myFix, route, trip, userId]);

  // --- transicoes ----------------------------------------------------------

  const [transition, setTransition] = useState<ReturnType<typeof detectTransition>>(null);

  useEffect(() => {
    if (!derived.status) return;
    const t = detectTransition(prevStatus.current, derived.status);
    prevStatus.current = derived.status;
    if (t) {
      setTransition(t);
      const id = setTimeout(() => setTransition(null), 6000);
      return () => clearTimeout(id);
    }
  }, [derived.status]);

  return {
    trip,
    route,
    me,
    members: derived.members,
    vehicles: derived.vehicles,
    status: derived.status,
    transition,
    myFix,
    permission,
    geoError,
    wakeLock,
    online,
    queued,
    pausedUntil,
    pauseLocation: (minutes: number) => setPausedUntil(Date.now() + minutes * 60_000),
    resumeLocation: () => setPausedUntil(null),
    loading,
    error,
    reload: () => tripId && void refreshMembers(tripId).then(setMembers),
  };
}
