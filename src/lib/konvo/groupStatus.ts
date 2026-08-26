/**
 * A funcao central do Konvo.
 *
 * Recebe os membros ja derivados e responde a unica pergunta que o produto
 * existe para responder: "o grupo ainda esta junto?" — em uma frase que da
 * para ler de relance, dirigindo (brief §31 e §32).
 *
 * Devolve chave de traducao + valores, nunca texto pronto: quem monta a frase
 * e a camada de i18n.
 */

import { THRESHOLDS as T } from "./thresholds";
import type { GroupStatus, GroupStatusKind, MemberState } from "./types";

/**
 * O minimo para posicionar alguem no grupo.
 *
 * Tanto `DerivedMember` quanto `Vehicle` satisfazem esta forma. Em producao a
 * entrada e de VEICULOS: o grupo se move em veiculos, e contar o motorista como
 * "sem sinal" enquanto o passageiro do lado transmite seria falso.
 */
export interface GroupUnit {
  id: string;
  displayName: string;
  state: MemberState;
  distanceAlongM: number | null;
  behindByS: number;
  etaS: number | null;
  /**
   * Segue a rota compartilhada. Quem vai de aviao, trem ou barco NAO entra na
   * geometria do comboio: dizer que o grupo "se dividiu" porque alguem esta
   * voando a 10 km de altura seria absurdo. Essa gente conta para "todos
   * chegaram" e para o horario de chegada, e nao para junto/esticando/dividido.
   */
  roadBound?: boolean;
}

export interface GroupStatusInput {
  members: GroupUnit[];
  /** ha uma parada compartilhada aceita e o grupo esta convergindo para ela */
  isRegrouping?: boolean;
}

export function deriveGroupStatus({
  members,
  isRegrouping = false,
}: GroupStatusInput): GroupStatus {
  const empty: GroupStatus = {
    kind: "together",
    headlineKey: "status.together",
    headlineValues: {},
    subjectIds: [],
    clusters: null,
    spreadS: 0,
    spreadM: 0,
  };

  if (members.length === 0) return empty;

  const arrived = members.filter((m) => m.state === "arrived");
  const offline = members.filter((m) => m.state === "offline");

  // Quem conta para a geometria do grupo: quem esta na estrada agora, e
  // seguindo a MESMA rota.
  const live = members
    .filter((m) => m.state !== "offline" && m.state !== "arrived")
    .filter((m) => m.roadBound !== false)
    .filter((m) => m.distanceAlongM !== null)
    .sort((a, b) => b.distanceAlongM! - a.distanceAlongM!); // da frente para tras

  // --- todo mundo chegou ---------------------------------------------------
  if (arrived.length === members.length) {
    return {
      ...empty,
      kind: "arrived",
      headlineKey: "status.allArrived",
      subjectIds: members.map((m) => m.id),
    };
  }

  // Sem ninguem transmitindo, o app precisa dizer isso — e nao fingir calma.
  if (live.length === 0) {
    return {
      ...empty,
      kind: "stopped",
      headlineKey: "status.noSignal",
      headlineValues: { count: offline.length },
      subjectIds: offline.map((m) => m.id),
    };
  }

  const lead = live[0];
  const tail = live[live.length - 1];
  const spreadM = lead.distanceAlongM! - tail.distanceAlongM!;
  const spreadS = tail.behindByS;

  const base = { ...empty, spreadM, spreadS };

  // --- divisao: a maior lacuna entre dois consecutivos ---------------------
  const { gapS, atIndex } = largestGap(live);
  if (gapS > T.group.splitGapS && live.length > 1) {
    const front = live.slice(0, atIndex + 1);
    const back = live.slice(atIndex + 1);
    return {
      ...base,
      kind: "split",
      headlineKey: "status.split",
      headlineValues: { front: front.length, back: back.length },
      subjectIds: back.map((m) => m.id),
      clusters: [front.map((m) => m.id), back.map((m) => m.id)],
    };
  }

  // --- convergindo para uma parada combinada -------------------------------
  if (isRegrouping) {
    return { ...base, kind: "regrouping", headlineKey: "status.regrouping" };
  }

  // --- alguem parado -------------------------------------------------------
  const stopped = live.filter((m) => m.state === "stopped");
  if (stopped.length > 0) {
    return {
      ...base,
      kind: "stopped",
      headlineKey: stopped.length === 1 ? "status.memberStopped" : "status.membersStopped",
      headlineValues: { name: stopped[0].displayName, count: stopped.length },
      subjectIds: stopped.map((m) => m.id),
    };
  }

  // --- esticando -----------------------------------------------------------
  if (spreadS > T.group.togetherS) {
    return {
      ...base,
      kind: "stretching",
      headlineKey: "status.fallingBehind",
      headlineValues: { name: tail.displayName },
      subjectIds: [tail.id],
    };
  }

  // --- chegando ------------------------------------------------------------
  // Chegada considera todo mundo, inclusive quem vem por caminho proprio: a
  // pergunta "quando estaremos todos la" inclui quem esta no aviao.
  const etas = members
    .filter((m) => m.state !== "offline" && m.state !== "arrived")
    .map((m) => m.etaS)
    .filter((e): e is number => e !== null);
  if (etas.length > 0 && Math.max(...etas) <= T.member.arrivingS) {
    return {
      ...base,
      kind: "arriving",
      headlineKey: "status.arrivingIn",
      headlineValues: { seconds: Math.max(...etas) },
      subjectIds: live.map((m) => m.id),
    };
  }

  // --- junto ---------------------------------------------------------------
  return {
    ...base,
    kind: "together",
    headlineKey: "status.together",
    subjectIds: members.map((m) => m.id),
  };
}

/** Maior intervalo entre dois membros consecutivos da fila. */
function largestGap(sorted: GroupUnit[]): { gapS: number; atIndex: number } {
  let gapS = 0;
  let atIndex = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const g = sorted[i + 1].behindByS - sorted[i].behindByS;
    if (g > gapS) {
      gapS = g;
      atIndex = i;
    }
  }
  return { gapS, atIndex };
}

// ---------------------------------------------------------------------------
// Transicoes
// ---------------------------------------------------------------------------

/**
 * "Pedro voltou pro grupo" (brief §13) nao e um estado — e a transicao entre
 * dois. Fica separado de proposito: o estado permanente vira `together`, e o
 * evento passageiro vira banner e linha no Activity.
 */
export type GroupTransition = "rejoined" | "split" | "stretched" | "arrived" | null;

const SEVERITY: Record<GroupStatusKind, number> = {
  together: 0,
  arriving: 0,
  arrived: 0,
  regrouping: 1,
  stretching: 2,
  stopped: 3,
  split: 4,
};

export function detectTransition(prev: GroupStatus | null, next: GroupStatus): GroupTransition {
  if (!prev || prev.kind === next.kind) return null;

  if (next.kind === "arrived") return "arrived";
  if (next.kind === "split") return "split";
  if (next.kind === "stretching" && SEVERITY[prev.kind] < SEVERITY.stretching) return "stretched";
  // voltou de qualquer estado ruim para junto
  if (next.kind === "together" && SEVERITY[prev.kind] >= SEVERITY.stretching) return "rejoined";

  return null;
}
