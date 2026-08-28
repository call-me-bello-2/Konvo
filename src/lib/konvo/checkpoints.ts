/**
 * Checkpoints — pontos combinados no MEIO do caminho.
 *
 * Numa viagem longa o grupo nao se reencontra no destino; se reencontra no
 * posto, no restaurante, na entrada da serra. O checkpoint transforma isso em
 * algo que o app entende sozinho: quando alguem entra no raio, todos veem
 * "2 de 4 chegaram" sem ninguem mandar mensagem.
 *
 * A deteccao acontece no cliente, sobre a posicao que ele ja tem. Poderia
 * viver no banco, mas ai dependeria de a escrita de posicao ter acontecido —
 * e num trecho sem sinal a chegada so seria registrada minutos depois, quando
 * a pessoa ja saiu do posto.
 */

import { haversineM } from "./route";
import type { DerivedMember, LatLng } from "./types";

export interface Checkpoint extends LatLng {
  id: string;
  name: string;
  /** metros de rota ate aqui */
  atDistanceM: number | null;
  radiusM: number;
}

export interface CheckpointProgress {
  checkpoint: Checkpoint;
  /** ids de quem ja passou */
  arrivedIds: string[];
  /** quem ainda nao passou, do mais perto para o mais longe */
  pendingIds: string[];
  /** todos passaram */
  complete: boolean;
  /** o proximo pela frente do grupo */
  isNext: boolean;
}

/** Alguem esta dentro do raio deste checkpoint agora? */
export function isInside(member: DerivedMember, cp: Checkpoint): boolean {
  if (!member.fix) return false;
  return haversineM(member.fix, cp) <= cp.radiusM;
}

/**
 * Estado de cada checkpoint para o grupo.
 *
 * `arrivals` vem do banco: quem JA passou, mesmo que agora esteja longe. Sem
 * isso, a chegada de alguem sumiria da tela assim que ele saisse do raio.
 */
export function deriveCheckpoints(
  checkpoints: Checkpoint[],
  members: DerivedMember[],
  arrivals: Map<string, Set<string>>,
): CheckpointProgress[] {
  // Quem conta: quem esta na estrada. Nao adianta esperar por quem ja chegou
  // ao destino final nem por quem esta sem sinal ha muito tempo.
  const active = members.filter((m) => m.state !== "arrived");

  const ordered = [...checkpoints].sort(
    (a, b) => (a.atDistanceM ?? 0) - (b.atDistanceM ?? 0),
  );

  // O proximo do grupo e o primeiro que ainda nao esta completo.
  let nextFound = false;

  return ordered.map((cp) => {
    const done = arrivals.get(cp.id) ?? new Set<string>();

    // Estar dentro do raio agora tambem conta — cobre a janela entre entrar no
    // posto e a gravacao no banco confirmar.
    const arrivedIds = active
      .filter((m) => done.has(m.id) || isInside(m, cp))
      .map((m) => m.id);

    const pendingIds = active
      .filter((m) => !arrivedIds.includes(m.id))
      .sort((a, b) => (b.distanceAlongM ?? 0) - (a.distanceAlongM ?? 0))
      .map((m) => m.id);

    const complete = active.length > 0 && pendingIds.length === 0;
    const isNext = !complete && !nextFound;
    if (isNext) nextFound = true;

    return { checkpoint: cp, arrivedIds, pendingIds, complete, isNext };
  });
}

/**
 * Chegadas novas desde a ultima verificacao.
 *
 * Devolvido separado para que a tela decida o que fazer — registrar no banco,
 * avisar o grupo, tocar um som. A funcao nao tem efeito colateral nenhum.
 */
export function newArrivals(
  checkpoints: Checkpoint[],
  member: DerivedMember,
  alreadyRegistered: Set<string>,
): Checkpoint[] {
  return checkpoints.filter((cp) => !alreadyRegistered.has(cp.id) && isInside(member, cp));
}
