/**
 * Rota — OSRM publico.
 *
 * Chamado UMA vez, na criacao da viagem, e o resultado e gravado em
 * `trips.route_polyline`. Em runtime nunca mais se consulta: o servidor publico
 * e de demonstracao, sem SLA, e a viagem nao pode depender de ele estar no ar
 * no meio da serra.
 *
 * Se falhar na criacao, cai para linha reta — degradado, mas o app continua
 * funcionando e toda a logica de grupo segue valendo.
 */

import { haversineM } from "@/lib/konvo/route";
import type { LatLng } from "@/lib/konvo/types";

const ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

export interface RouteResult {
  /** polyline codificada, precisao 5 */
  polyline: string | null;
  distanceM: number;
  durationS: number;
  /** true quando a OSRM nao respondeu e caimos na linha reta */
  degraded: boolean;
}

/** Velocidade usada no fallback de linha reta: media realista de estrada. */
const FALLBACK_SPEED_MPS = 20;

export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;

  try {
    const res = await fetch(`${ENDPOINT}/${coords}?overview=full&geometries=polyline`, {
      signal,
    });
    if (!res.ok) throw new Error(`OSRM respondeu ${res.status}`);

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry) throw new Error("OSRM devolveu rota vazia");

    return {
      polyline: route.geometry,
      distanceM: Math.round(route.distance),
      durationS: Math.round(route.duration),
      degraded: false,
    };
  } catch (err) {
    if (signal?.aborted) throw err;

    // Criar a viagem e mais importante do que ter a geometria exata da estrada.
    const straight = haversineM(from, to);
    return {
      polyline: null,
      distanceM: Math.round(straight),
      durationS: Math.round(straight / FALLBACK_SPEED_MPS),
      degraded: true,
    };
  }
}

/**
 * Link para o app de navegacao escolhido (brief §17).
 *
 * O Konvo nao faz navegacao curva a curva — ele entrega o destino para quem faz.
 */
export function navigationUrl(to: LatLng, app: "waze" | "gmaps"): string {
  return app === "waze"
    ? `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`;
}
