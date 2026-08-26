/**
 * Derivacao do estado de cada participante.
 *
 * Entra: posicao crua + rota. Sai: o que a interface precisa dizer em
 * linguagem humana (brief §31). Nenhum componente calcula isso por conta.
 */

import { THRESHOLDS as T } from "./thresholds";
import { projectOnRoute, haversineM, type Route } from "./route";
import { isRoadBound } from "./types";
import type { DerivedMember, LatLng, MemberState, TripMember } from "./types";

/**
 * Estado que atravessa chamadas sucessivas.
 *
 * "Parado" nao da para saber de uma leitura so — precisa de duracao. Em vez de
 * esconder isso num singleton, o contexto e explicito: o hook mantem um, e os
 * testes criam um novo a cada caso.
 */
export interface DeriveContext {
  route: Route;
  destination: LatLng;
  now: number;
  /** velocidade de referencia do grupo, m/s (vem da estimativa da rota) */
  referenceSpeedMps: number;
  /** quando cada membro comecou a andar devagar */
  slowSince: Map<string, number>;
  /** ultimo indice de projecao, para acelerar a busca seguinte */
  hints: Map<string, number>;
}

export function createDeriveContext(
  route: Route,
  destination: LatLng,
  routeDurationS: number | null,
): DeriveContext {
  const implied =
    routeDurationS && routeDurationS > 0 ? route.totalM / routeDurationS : T.fallback.speedMps;

  return {
    route,
    destination,
    now: Date.now(),
    referenceSpeedMps: clamp(implied, T.fallback.minSpeedMps, 33),
    slowSince: new Map(),
    hints: new Map(),
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Deriva todos os membros de uma vez.
 *
 * Precisa ser em lote porque "atras" so existe em relacao a frente do grupo —
 * nenhum membro tem estado sozinho.
 */
export function deriveMembers(members: TripMember[], ctx: DeriveContext): DerivedMember[] {
  const { now, route } = ctx;

  // --- passo 1: projetar cada um sobre a rota -------------------------------
  const projected = members.map((m) => {
    const staleForMs = m.lastSeenAt ? now - m.lastSeenAt : Infinity;

    // fix impreciso demais nao entra: GPS entre predios chega a errar 200 m,
    // e uma leitura ruim faria o grupo "se dividir" sem ninguem sair do lugar.
    const usable =
      m.fix && m.fix.accuracy <= T.member.maxAccuracyM ? m.fix : null;

    let distanceAlongM = m.distanceAlongM;
    let offRouteM = m.offRouteM;

    // Quem vai de aviao, trem ou barco nao passa pela estrada do grupo:
    // projetar a posicao na polyline daria "fora de rota" o tempo todo e
    // distancias sem sentido. Para eles vale a distancia direta ao destino.
    const roadBound = isRoadBound(m.transport);

    if (usable && roadBound) {
      const p = projectOnRoute(route, usable, ctx.hints.get(m.id));
      ctx.hints.set(m.id, p.index);
      distanceAlongM = p.distanceAlongM;
      offRouteM = p.offRouteM;
    } else if (usable) {
      // Marco equivalente na rota, so para ordenar a lista: quanto falta em
      // linha reta, convertido para "posicao" no mesmo eixo dos outros.
      const direct = haversineM(usable, ctx.destination);
      distanceAlongM = Math.max(0, route.totalM - direct);
      offRouteM = null;
    }

    return { m, usable, staleForMs, distanceAlongM, offRouteM, roadBound };
  });

  // --- passo 2: onde esta a frente do grupo ---------------------------------
  const live = projected.filter(
    (p) => p.distanceAlongM !== null && p.staleForMs < T.member.offlineAfterMs,
  );
  const leadM = live.length ? Math.max(...live.map((p) => p.distanceAlongM!)) : 0;

  // --- passo 3: estado individual ------------------------------------------
  return projected.map(({ m, usable, staleForMs, distanceAlongM, offRouteM, roadBound }) => {
    // Em linha reta para quem tem caminho proprio; pela rota para o resto.
    const remainingM = usable && !roadBound
      ? haversineM(usable, ctx.destination)
      : distanceAlongM === null
        ? null
        : Math.max(0, route.totalM - distanceAlongM);

    // velocidade util: a do GPS quando confiavel, senao a referencia do grupo
    const rawSpeed = usable?.speed ?? null;
    // Aviao a 800 km/h nao pode herdar a velocidade media da estrada: o ETA
    // sairia dez vezes maior. Para caminho proprio, so a leitura real vale.
    const speedMps =
      rawSpeed !== null && rawSpeed > T.fallback.minSpeedMps
        ? rawSpeed
        : roadBound
          ? ctx.referenceSpeedMps
          : T.fallback.speedMps;

    const etaS = remainingM === null ? null : Math.round(remainingM / speedMps);

    const behindByM = distanceAlongM === null ? 0 : Math.max(0, leadM - distanceAlongM);
    // gap medido sempre na velocidade de referencia do grupo: assim "4 min
    // atras" significa a mesma coisa para todo mundo e nao oscila com o
    // ruido da leitura de velocidade de cada aparelho.
    const behindByS = Math.round(behindByM / ctx.referenceSpeedMps);

    // --- parado: precisa de duracao, nao de uma leitura ---
    const isSlow = rawSpeed !== null && rawSpeed < T.member.stoppedSpeedMps;
    if (isSlow) {
      if (!ctx.slowSince.has(m.id)) ctx.slowSince.set(m.id, usable?.at ?? now);
    } else if (rawSpeed !== null) {
      ctx.slowSince.delete(m.id);
    }
    const slowSince = ctx.slowSince.get(m.id);
    const stoppedForMs = slowSince ? now - slowSince : 0;

    const distToDest = usable ? haversineM(usable, ctx.destination) : Infinity;

    const state = resolveState({
      arrivedAt: m.arrivedAt,
      distToDest,
      staleForMs,
      hasFix: distanceAlongM !== null,
      stoppedForMs,
      // Sem rota compartilhada nao existe "fora de rota".
      offRouteM: roadBound ? offRouteM : null,
      behindByS: roadBound ? behindByS : 0,
    });

    return {
      ...m,
      distanceAlongM,
      offRouteM,
      state,
      remainingM,
      etaS,
      behindByS,
      behindByM,
      staleForMs,
    };
  });
}

function resolveState(x: {
  arrivedAt: string | null;
  distToDest: number;
  staleForMs: number;
  hasFix: boolean;
  stoppedForMs: number;
  offRouteM: number | null;
  behindByS: number;
}): MemberState {
  // A ordem e a prioridade do que a pessoa precisa saber primeiro.
  if (x.arrivedAt || x.distToDest <= T.member.arrivedRadiusM) return "arrived";
  if (!x.hasFix) return "offline";
  if (x.staleForMs >= T.member.offlineAfterMs) return "offline";
  if (x.stoppedForMs >= T.member.stoppedForMs) return "stopped";
  if (x.offRouteM !== null && x.offRouteM > T.member.offRouteM) return "off_route";
  if (x.behindByS >= T.group.togetherS) return "behind";
  return "on_route";
}
