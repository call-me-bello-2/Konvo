import { useMemo } from "react";

import { pointAtDistance, type Route } from "@/lib/konvo/route";
import { participantColor } from "./ParticipantAvatar";

/**
 * Miniatura da rota, em SVG.
 *
 * No card da Home nao ha o que fazer com tiles de mapa: em 96 px de altura
 * ninguem le nome de rua, e carregar MapLibre ali custaria bateria e dados numa
 * tela que a pessoa so passa o olho. O que importa e a FORMA do trajeto e onde
 * cada um esta nela — e isso o SVG mostra melhor, e de graca.
 *
 * O mapa de verdade fica onde e util: no Live Konvo.
 */

interface Props {
  route: Route;
  /**
   * Metros ja percorridos pela frente do grupo. Quando informado, o trecho
   * andado aparece solido e o restante apagado.
   *
   * Numa rota de 227 km, cinco participantes a 2 km um do outro ocupam menos
   * de um pixel: desenhar cinco bolinhas ali empilha tudo num ponto so e nao
   * informa nada. Nesta escala a informacao util e o progresso — a identidade
   * de cada um fica na fileira de avatares, onde da para ler.
   */
  progressM?: number;
  /** posicao individual; so vale a pena em recortes de mapa mais fechados */
  marks?: { id: string; atM: number; colorIndex: number }[];
  className?: string;
  height?: number;
  /** proporcao do viewBox; deve acompanhar a do container */
  aspect?: number;
}

const PAD = 10;

export function RoutePreview({
  route,
  progressM,
  marks = [],
  className,
  height = 96,
  aspect = 3.3,
}: Props) {
  const VB_W = 100;
  const VB_H = VB_W / aspect;

  const geo = useMemo(() => {
    // ~120 pontos bastam para a silhueta; 4 mil seriam desperdicio de DOM
    const step = Math.max(1, Math.floor(route.points.length / 120));
    const pts = route.points.filter((_, i) => i % step === 0);
    const last = route.points[route.points.length - 1];
    if (pts[pts.length - 1] !== last) pts.push(last);

    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // corrige a distorcao da longitude nesta latitude, senao a rota "achata"
    const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
    const spanX = (maxLng - minLng) * cosLat || 1e-9;
    const spanY = maxLat - minLat || 1e-9;

    // uma escala so para os dois eixos: a rota nao pode ser esticada
    const boxW = VB_W - PAD * 2;
    const boxH = VB_H - PAD * 2;
    const scale = Math.min(boxW / spanX, boxH / spanY);

    // sobra depois de escalar, dividida nos dois lados = centralizado
    const offX = (VB_W - spanX * scale) / 2;
    const offY = (VB_H - spanY * scale) / 2;

    const project = (p: { lat: number; lng: number }) => ({
      x: offX + (p.lng - minLng) * cosLat * scale,
      // y invertido: latitude cresce para cima, SVG cresce para baixo
      y: offY + (maxLat - p.lat) * scale,
    });

    const toPath = (list: { x: number; y: number }[]) =>
      list.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

    const projected = pts.map(project);

    // trecho ja andado: pontos ate o marco, mais o ponto exato do marco para
    // a linha nao terminar antes da hora
    let traveled: string | null = null;
    if (progressM !== undefined && progressM > 0) {
      // Infinity, nao 0: o ponto final anexado a amostragem cai fora do indice
      // de `cumulative`, e um fallback 0 o faria passar como "ja percorrido" —
      // desenhando a linha solida ate o destino.
      const upto = projected.filter(
        (_, i) => (route.cumulative[i * step] ?? Infinity) <= progressM,
      );
      upto.push(project(pointAtDistance(route, progressM)));
      if (upto.length > 1) traveled = toPath(upto);
    }

    return {
      d: toPath(projected),
      traveled,
      head: progressM === undefined ? null : project(pointAtDistance(route, progressM)),
      start: project(route.points[0]),
      end: project(last),
      project,
    };
  }, [route, VB_H, progressM]);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ height, width: "100%" }}
      role="img"
      aria-label="Route preview"
    >
      {/* traco de base, para a rota nao sumir sobre o fundo claro */}
      <path
        d={geo.d}
        fill="none"
        stroke="var(--color-surface-3)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={geo.d}
        fill="none"
        stroke={geo.traveled ? "var(--color-konvo-200)" : "var(--color-konvo-300)"}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {geo.traveled && (
        <path
          d={geo.traveled}
          fill="none"
          stroke="var(--color-konvo-500)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* destino */}
      <circle cx={geo.end.x} cy={geo.end.y} r={2.2} fill="var(--color-ink)" />
      <circle cx={geo.end.x} cy={geo.end.y} r={0.85} fill="var(--color-surface)" />

      {/* origem */}
      <circle cx={geo.start.x} cy={geo.start.y} r={1.5} fill="var(--color-ink-35)" />

      {/* a frente do grupo */}
      {geo.head && (
        <circle
          cx={geo.head.x}
          cy={geo.head.y}
          r={2.6}
          fill="var(--color-konvo-500)"
          stroke="var(--color-surface)"
          strokeWidth={1.1}
        />
      )}

      {marks.map((m) => {
        const p = geo.project(pointAtDistance(route, m.atM));
        return (
          <circle
            key={m.id}
            cx={p.x}
            cy={p.y}
            r={2.2}
            fill={participantColor(m.colorIndex)}
            stroke="var(--color-surface)"
            strokeWidth={0.9}
          />
        );
      })}
    </svg>
  );
}
