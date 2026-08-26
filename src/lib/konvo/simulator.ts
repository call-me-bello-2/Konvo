/**
 * Simulador de viagem (brief §27).
 *
 * Move carros de mentira sobre uma rota de verdade, para dar para ver e testar
 * cada estado do grupo sem precisar de tres celulares numa estrada.
 *
 * O ponto importante: ele produz POSICAO, e nada mais. Quem decide se o grupo
 * esta junto, esticando ou dividido continua sendo `groupStatus.ts` — a mesma
 * funcao que vai rodar com GPS real. Se fosse o simulador dizendo o estado, o
 * teste nao provaria nada.
 */

import { pointAtDistance, type Route } from "./route";
import type { Fix, TransportType, TripMember } from "./types";

export type ScenarioId =
  | "together"
  | "stretching"
  | "split"
  | "stopped"
  | "offline"
  | "arriving"
  | "arrived";

export interface ScenarioActor {
  id: string;
  name: string;
  colorIndex: number;
  transport: TransportType;
  ridingWith?: string;
  /** posicao na rota, como fracao de 0 a 1 */
  at: number;
  /** m/s; 0 = parado */
  speed?: number;
  /** ha quantos segundos foi a ultima transmissao */
  staleS?: number;
  isLeader?: boolean;
}

/**
 * Os cenarios do brief §13, escritos como posicoes.
 *
 * As distancias sao propositalmente calibradas nos limiares de
 * `thresholds.ts`: se alguem mexer nos limiares e esquecer de conferir aqui,
 * um cenario para de reproduzir o estado que promete — e isso aparece na tela.
 */
export const SCENARIOS: Record<ScenarioId, { label: string; actors: ScenarioActor[] }> = {
  together: {
    label: "Todos juntos",
    actors: [
      { id: "gustavo", name: "Gustavo", colorIndex: 1, transport: "car", at: 0.38, isLeader: true },
      { id: "gabriel", name: "Gabriel", colorIndex: 2, transport: "car", at: 0.3785 },
      { id: "lucas", name: "Lucas", colorIndex: 3, transport: "motorcycle", at: 0.3775 },
      { id: "pedro", name: "Pedro", colorIndex: 4, transport: "car", at: 0.376 },
      { id: "ana", name: "Ana", colorIndex: 5, transport: "passenger", ridingWith: "pedro", at: 0.376 },
    ],
  },
  stretching: {
    label: "Esticando",
    actors: [
      { id: "gustavo", name: "Gustavo", colorIndex: 1, transport: "car", at: 0.38, isLeader: true },
      { id: "gabriel", name: "Gabriel", colorIndex: 2, transport: "car", at: 0.3785 },
      { id: "lucas", name: "Lucas", colorIndex: 3, transport: "motorcycle", at: 0.3625 },
      { id: "pedro", name: "Pedro", colorIndex: 4, transport: "car", at: 0.3765 },
      { id: "ana", name: "Ana", colorIndex: 5, transport: "passenger", ridingWith: "pedro", at: 0.3765 },
    ],
  },
  split: {
    label: "Grupo dividido",
    actors: [
      { id: "gustavo", name: "Gustavo", colorIndex: 1, transport: "car", at: 0.38, isLeader: true },
      { id: "gabriel", name: "Gabriel", colorIndex: 2, transport: "car", at: 0.3785 },
      { id: "lucas", name: "Lucas", colorIndex: 3, transport: "motorcycle", at: 0.335 },
      { id: "pedro", name: "Pedro", colorIndex: 4, transport: "car", at: 0.331 },
      { id: "ana", name: "Ana", colorIndex: 5, transport: "passenger", ridingWith: "pedro", at: 0.331 },
    ],
  },
  stopped: {
    label: "Alguém parou",
    actors: [
      { id: "gustavo", name: "Gustavo", colorIndex: 1, transport: "car", at: 0.38, isLeader: true },
      { id: "gabriel", name: "Gabriel", colorIndex: 2, transport: "car", at: 0.3785 },
      { id: "lucas", name: "Lucas", colorIndex: 3, transport: "motorcycle", at: 0.377 },
      { id: "pedro", name: "Pedro", colorIndex: 4, transport: "car", at: 0.3755, speed: 0 },
      { id: "ana", name: "Ana", colorIndex: 5, transport: "passenger", ridingWith: "pedro", at: 0.3755, speed: 0 },
    ],
  },
  offline: {
    label: "Sem sinal",
    actors: [
      { id: "gustavo", name: "Gustavo", colorIndex: 1, transport: "car", at: 0.38, isLeader: true },
      { id: "gabriel", name: "Gabriel", colorIndex: 2, transport: "car", at: 0.3785 },
      // Lucas sumiu ha 4 min: a interface tem que dizer isso, e NAO tratar como
      // divisao do grupo — nao se sabe onde ele esta.
      { id: "lucas", name: "Lucas", colorIndex: 3, transport: "motorcycle", at: 0.372, staleS: 240 },
      { id: "pedro", name: "Pedro", colorIndex: 4, transport: "car", at: 0.3765 },
      { id: "ana", name: "Ana", colorIndex: 5, transport: "passenger", ridingWith: "pedro", at: 0.3765 },
    ],
  },
  arriving: {
    label: "Chegando",
    actors: [
      { id: "gustavo", name: "Gustavo", colorIndex: 1, transport: "car", at: 0.995, isLeader: true },
      { id: "gabriel", name: "Gabriel", colorIndex: 2, transport: "car", at: 0.9935 },
      { id: "lucas", name: "Lucas", colorIndex: 3, transport: "motorcycle", at: 0.9925 },
      { id: "pedro", name: "Pedro", colorIndex: 4, transport: "car", at: 0.991 },
      { id: "ana", name: "Ana", colorIndex: 5, transport: "passenger", ridingWith: "pedro", at: 0.991 },
    ],
  },
  arrived: {
    label: "Todos chegaram",
    actors: [
      { id: "gustavo", name: "Gustavo", colorIndex: 1, transport: "car", at: 1, isLeader: true },
      { id: "gabriel", name: "Gabriel", colorIndex: 2, transport: "car", at: 1 },
      { id: "lucas", name: "Lucas", colorIndex: 3, transport: "motorcycle", at: 1 },
      { id: "pedro", name: "Pedro", colorIndex: 4, transport: "car", at: 1 },
      { id: "ana", name: "Ana", colorIndex: 5, transport: "passenger", ridingWith: "pedro", at: 1 },
    ],
  },
};

export const SCENARIO_ORDER: ScenarioId[] = [
  "together",
  "stretching",
  "split",
  "stopped",
  "offline",
  "arriving",
  "arrived",
];

const DEFAULT_SPEED = 25; // m/s, ~90 km/h

/**
 * Constroi os membros de um cenario, deslocados por `progress`.
 *
 * `progress` avanca o grupo inteiro pela rota, mantendo as distancias
 * relativas — e o que faz os pinos andarem na tela sem mudar o estado.
 */
export function buildScenario(
  scenario: ScenarioId,
  route: Route,
  progress: number,
  now: number,
): TripMember[] {
  const { actors } = SCENARIOS[scenario];

  return actors.map((a) => {
    const frac = Math.min(1, Math.max(0, a.at + progress));
    const meters = frac * route.totalM;
    const p = pointAtDistance(route, meters);
    const staleMs = (a.staleS ?? 0) * 1000;

    const fix: Fix = {
      lat: p.lat,
      lng: p.lng,
      accuracy: 8,
      heading: null,
      speed: a.speed ?? DEFAULT_SPEED,
      at: now - staleMs,
    };

    return {
      id: a.id,
      tripId: "demo",
      userId: `u-${a.id}`,
      displayName: a.name,
      avatarUrl: null,
      colorIndex: a.colorIndex,
      transport: a.transport,
      isLeader: a.isLeader ?? false,
      ridingWith: a.ridingWith ?? null,
      fix,
      distanceAlongM: null,
      offRouteM: null,
      arrivedAt: frac >= 1 ? new Date(now).toISOString() : null,
      lastSeenAt: now - staleMs,
    } satisfies TripMember;
  });
}
