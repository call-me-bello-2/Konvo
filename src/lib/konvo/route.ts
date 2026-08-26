/**
 * Geometria da rota.
 *
 * Ideia central do produto: projetar cada posicao GPS sobre a polyline da rota
 * reduz o problema a UMA dimensao — "quantos metros de rota ja andou". Com isso,
 * quem esta na frente, quem ficou pra tras e onde o grupo se partiu sai de
 * comparacao de numeros, sem heuristica geografica fragil.
 */

import type { LatLng } from "./types";

const EARTH_R = 6_371_008.8; // metros, raio medio
const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Distancia
// ---------------------------------------------------------------------------

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const la = a.lat * RAD;
  const lb = b.lat * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------------------------------------------------------------------------
// Polyline (algoritmo do Google, precisao 5 — o que a OSRM devolve)
// ---------------------------------------------------------------------------

export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Rota preparada
// ---------------------------------------------------------------------------

export interface Route {
  points: LatLng[];
  /** cumulative[i] = metros do inicio ate points[i]. cumulative[0] = 0. */
  cumulative: number[];
  totalM: number;
}

/** Prepara a rota uma vez; a projecao depois so faz aritmetica. */
export function buildRoute(points: LatLng[]): Route {
  const cumulative = new Array<number>(points.length);
  cumulative[0] = 0;
  for (let i = 1; i < points.length; i++) {
    cumulative[i] = cumulative[i - 1] + haversineM(points[i - 1], points[i]);
  }
  return { points, cumulative, totalM: cumulative[points.length - 1] ?? 0 };
}

export function routeFromPolyline(encoded: string): Route {
  return buildRoute(decodePolyline(encoded));
}

/**
 * Fallback quando a OSRM nao respondeu na criacao da trip: linha reta.
 * Degradado — as distancias ficam otimistas — mas o app continua funcional,
 * e todo o resto da logica de grupo segue valendo.
 */
export function straightLineRoute(from: LatLng, to: LatLng): Route {
  return buildRoute([from, to]);
}

// ---------------------------------------------------------------------------
// Projecao
// ---------------------------------------------------------------------------

export interface Projection {
  /** metros de rota percorridos ate o ponto projetado */
  distanceAlongM: number;
  /** distancia perpendicular do ponto real ate a rota, em metros */
  offRouteM: number;
  /** indice do segmento onde caiu */
  index: number;
}

/**
 * Projeta um ponto sobre a rota.
 *
 * `hintIndex` evita varrer a polyline inteira a cada leitura: como o carro anda
 * pra frente, a resposta esta quase sempre perto da anterior. Sem o hint, uma
 * rota de 227 km (~4 mil pontos) x 5 membros x 1 Hz e desperdicio puro.
 * A janela e generosa o bastante para aguentar um tunel ou um salto de GPS; se
 * o resultado ficar ruim, refaz a busca completa.
 */
export function projectOnRoute(route: Route, point: LatLng, hintIndex?: number): Projection {
  const { points } = route;
  if (points.length < 2) {
    return { distanceAlongM: 0, offRouteM: haversineM(points[0] ?? point, point), index: 0 };
  }

  const scan = (from: number, to: number): Projection => {
    let best: Projection = { distanceAlongM: 0, offRouteM: Infinity, index: from };

    // aproximacao planar local: barata e precisa na escala de um segmento
    const latRef = point.lat * RAD;
    const mPerDegLat = 111_132.9;
    const mPerDegLng = 111_320 * Math.cos(latRef);

    for (let i = from; i < to; i++) {
      const a = points[i];
      const b = points[i + 1];

      const ax = 0;
      const ay = 0;
      const bx = (b.lng - a.lng) * mPerDegLng;
      const by = (b.lat - a.lat) * mPerDegLat;
      const px = (point.lng - a.lng) * mPerDegLng;
      const py = (point.lat - a.lat) * mPerDegLat;

      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;

      // t = quanto do segmento foi percorrido, preso entre as pontas
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));

      const cx = t * dx;
      const cy = t * dy;
      const off = Math.hypot(px - cx, py - cy);

      if (off < best.offRouteM) {
        const segLen = route.cumulative[i + 1] - route.cumulative[i];
        best = {
          distanceAlongM: route.cumulative[i] + t * segLen,
          offRouteM: off,
          index: i,
        };
      }
    }

    return best;
  };

  if (hintIndex !== undefined) {
    const from = Math.max(0, hintIndex - 30);
    const to = Math.min(points.length - 1, hintIndex + 120);
    const near = scan(from, to);
    // confiou no hint e deu certo? entrega. senao, varre tudo.
    if (near.offRouteM < 2_000) return near;
  }

  return scan(0, points.length - 1);
}

/** Ponto da rota a N metros do inicio. Usado para desenhar paradas e previews. */
export function pointAtDistance(route: Route, meters: number): LatLng {
  const { points, cumulative, totalM } = route;
  if (meters <= 0) return points[0];
  if (meters >= totalM) return points[points.length - 1];

  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= meters) lo = mid;
    else hi = mid;
  }

  const segLen = cumulative[hi] - cumulative[lo];
  const t = segLen === 0 ? 0 : (meters - cumulative[lo]) / segLen;
  return {
    lat: points[lo].lat + (points[hi].lat - points[lo].lat) * t,
    lng: points[lo].lng + (points[hi].lng - points[lo].lng) * t,
  };
}

/** Trecho da rota entre dois marcos, para desenhar so o que interessa. */
export function sliceRoute(route: Route, fromM: number, toM: number): LatLng[] {
  const out: LatLng[] = [pointAtDistance(route, fromM)];
  for (let i = 0; i < route.points.length; i++) {
    const d = route.cumulative[i];
    if (d > fromM && d < toM) out.push(route.points[i]);
  }
  out.push(pointAtDistance(route, toM));
  return out;
}

/**
 * Direcao da rota no ponto a N metros do inicio, em graus (0 = norte).
 *
 * Usada pela camera em terceira pessoa. Vem da GEOMETRIA da rota, e nao do
 * `heading` do GPS, de proposito: o heading do aparelho chega nulo em baixa
 * velocidade e oscila com o carro parado — a camera ficaria girando sozinha no
 * semaforo. A rota nao treme.
 */
export function bearingAt(route: Route, meters: number): number {
  // Uma janela de 150 m suaviza o tracado: segmento a segmento, cada curva
  // pequena da polyline viraria um solavanco na camera.
  const WINDOW = 150;
  const from = pointAtDistance(route, Math.max(0, meters - WINDOW / 2));
  const to = pointAtDistance(route, Math.min(route.totalM, meters + WINDOW / 2));

  const lat1 = from.lat * RAD;
  const lat2 = to.lat * RAD;
  const dLng = (to.lng - from.lng) * RAD;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (Math.atan2(y, x) * 180) / Math.PI;
}
