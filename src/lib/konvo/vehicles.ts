/**
 * Agregacao de pessoas em veiculos.
 *
 * O grupo se move em veiculos, nao em pessoas. Dois passageiros do mesmo carro
 * nunca vao "se dividir", e desenhar dois pinos sobrepostos no mapa nao informa
 * nada. A geometria do grupo trabalha sobre veiculos; a lista de participantes
 * continua mostrando pessoas.
 */

import { isRoadBound } from "./types";
import type { DerivedMember, MemberState, Vehicle } from "./types";

/**
 * A posicao do veiculo vem do ocupante com leitura mais recente.
 *
 * Isto e o que faz o esquema de "um celular dedicado por carro" funcionar: o
 * motorista pode fechar o Konvo para usar o Waze que o carro continua no mapa,
 * rastreado pelo celular de quem esta do lado. Sem isso o carro apareceria
 * "sem sinal" com alguem transmitindo do banco do passageiro.
 */
function pickSource(occupants: DerivedMember[]): DerivedMember | null {
  const withFix = occupants.filter((o) => o.distanceAlongM !== null);
  if (withFix.length === 0) return null;
  return withFix.reduce((best, o) => (o.staleForMs < best.staleForMs ? o : best));
}

/** O estado do veiculo e o do ocupante que o representa. */
function vehicleState(source: DerivedMember | null, occupants: DerivedMember[]): MemberState {
  if (source) return source.state;
  // ninguem transmitindo: se todos ja chegaram, chegou; senao, sem sinal
  return occupants.every((o) => o.state === "arrived") ? "arrived" : "offline";
}

export function deriveVehicles(members: DerivedMember[]): Vehicle[] {
  const byId = new Map(members.map((m) => [m.id, m]));

  // Condutores: quem nao aponta para ninguem. Uma carona apontando para um
  // membro que saiu da viagem tambem conduz — melhor um pino a mais no mapa do
  // que uma pessoa que some dele.
  const drivers = members.filter(
    (m) => m.ridingWith === null || !byId.has(m.ridingWith),
  );

  const passengersOf = new Map<string, DerivedMember[]>();
  for (const m of members) {
    if (m.ridingWith && byId.has(m.ridingWith)) {
      const list = passengersOf.get(m.ridingWith) ?? [];
      list.push(m);
      passengersOf.set(m.ridingWith, list);
    }
  }

  return drivers.map((driver) => {
    const passengers = passengersOf.get(driver.id) ?? [];
    const occupants = [driver, ...passengers];
    const source = pickSource(occupants);

    return {
      id: driver.id,
      displayName: driver.displayName,
      transport: driver.transport,
      roadBound: isRoadBound(driver.transport),
      driver,
      passengers,
      occupants,
      source,
      distanceAlongM: source?.distanceAlongM ?? null,
      state: vehicleState(source, occupants),
      etaS: source?.etaS ?? null,
      remainingM: source?.remainingM ?? null,
      behindByS: source?.behindByS ?? 0,
      behindByM: source?.behindByM ?? 0,
    };
  });
}

/**
 * "5 pessoas · 4 veiculos" (brief §07).
 *
 * Conta condutores, nao pessoas: e o que o exemplo do brief mostra — Gustavo,
 * Gabriel e Pedro de carro, Lucas de moto, Ana de carona com o Pedro.
 */
export function countVehicles(members: { ridingWith: string | null }[]): number {
  return members.filter((m) => m.ridingWith === null).length;
}
