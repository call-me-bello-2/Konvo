import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addCheckpoint,
  listArrivals,
  listCheckpoints,
  removeCheckpoint,
} from "@/lib/db/checkpoints";
import { logEvent } from "@/lib/db/live";
import { deriveCheckpoints, newArrivals, type Checkpoint } from "@/lib/konvo/checkpoints";
import { projectOnRoute, type Route } from "@/lib/konvo/route";
import type { DerivedMember, LatLng } from "@/lib/konvo/types";

/**
 * Checkpoints de uma viagem, com registro automatico de chegada.
 *
 * O registro acontece sozinho: quem esta dirigindo nao vai tocar em "cheguei".
 * A deteccao usa a posicao que o app ja tem, e a gravacao so ocorre na
 * transicao — entrar no raio uma vez, nao a cada leitura de GPS enquanto a
 * pessoa esta parada no posto.
 */

export function useCheckpoints(
  tripId: string | undefined,
  route: Route | null,
  me: DerivedMember | null,
  members: DerivedMember[],
) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [arrivals, setArrivals] = useState<Map<string, Set<string>>>(new Map());

  /** o que ja registramos nesta sessao, para nao gravar em loop */
  const registered = useRef<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!tripId) return;
    const [cps, arr] = await Promise.all([
      listCheckpoints(tripId).catch(() => []),
      listArrivals(tripId).catch(() => new Map<string, Set<string>>()),
    ]);
    setCheckpoints(cps);
    setArrivals(arr);
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // --- registro automatico de chegada ---------------------------------------

  useEffect(() => {
    if (!tripId || !me || checkpoints.length === 0) return;

    const reached = newArrivals(checkpoints, me, registered.current);
    if (reached.length === 0) return;

    for (const cp of reached) {
      registered.current.add(cp.id);

      // O evento e o que faz o resto do grupo saber. A gravacao da chegada em
      // si vai junto, mas e o evento que aparece na conversa.
      void logEvent(tripId, me.id, "checkpoint_reached", {
        name: me.displayName,
        place: cp.name,
        checkpointId: cp.id,
      }).catch(() => {});
    }

    void reload();
  }, [tripId, me, checkpoints, reload]);

  // --- estado derivado -------------------------------------------------------

  const progress = useMemo(
    () => deriveCheckpoints(checkpoints, members, arrivals),
    [checkpoints, members, arrivals],
  );

  /**
   * Adiciona um ponto, calculando onde ele cai na rota.
   *
   * A distancia ao longo da rota e o que ordena os checkpoints e permite
   * desenha-los no tracado. Fora da rota (um desvio proposital), fica sem
   * marco — melhor um checkpoint sem posicao na linha do que recusar o ponto.
   */
  const add = useCallback(
    async (place: LatLng & { name: string }) => {
      if (!tripId) return;
      const atDistanceM = route ? projectOnRoute(route, place).distanceAlongM : null;
      await addCheckpoint(tripId, place, atDistanceM);
      await reload();
    },
    [tripId, route, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await removeCheckpoint(id);
      registered.current.delete(id);
      await reload();
    },
    [reload],
  );

  return { checkpoints, progress, add, remove, reload };
}
