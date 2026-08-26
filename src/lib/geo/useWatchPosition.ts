import { useCallback, useEffect, useRef, useState } from "react";

import { THRESHOLDS as T } from "@/lib/konvo/thresholds";
import { haversineM } from "@/lib/konvo/route";
import type { Fix } from "@/lib/konvo/types";

/**
 * Leitura continua do GPS.
 *
 * Duas decisoes que so aparecem na estrada:
 *
 * 1. Throttle na PUBLICACAO, nao na leitura. O `watchPosition` continua
 *    entregando tudo (a leitura mais recente e sempre a melhor para a tela do
 *    proprio dono), mas so vira escrita se andou >50 m ou passaram >10 s. Um
 *    carro a 100 km/h gera fix a cada segundo; escrever tudo isso queima
 *    bateria e dados sem melhorar nada.
 *
 * 2. Carro parado continua publicando pelo intervalo de tempo. E isso que
 *    permite distinguir "parou no posto" de "sumiu numa area sem sinal" —
 *    duas coisas muito diferentes para quem esta esperando na frente.
 */

export type PermissionState = "prompt" | "granted" | "denied" | "unsupported";

interface Options {
  enabled: boolean;
  /** chamado quando ha posicao nova que merece ser publicada */
  onPublish: (fix: Fix) => void;
}

export function useWatchPosition({ enabled, onPublish }: Options) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [permission, setPermission] = useState<PermissionState>(
    "geolocation" in navigator ? "prompt" : "unsupported",
  );
  const [error, setError] = useState<string | null>(null);

  const lastPublished = useRef<Fix | null>(null);
  const onPublishRef = useRef(onPublish);
  onPublishRef.current = onPublish;

  const handle = useCallback((pos: GeolocationPosition) => {
    const next: Fix = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
      speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
      at: pos.timestamp,
    };

    setFix(next);
    setPermission("granted");
    setError(null);

    const prev = lastPublished.current;
    const moved = prev ? haversineM(prev, next) : Infinity;
    const elapsed = prev ? next.at - prev.at : Infinity;

    if (moved >= T.publish.minMoveM || elapsed >= T.publish.maxIntervalMs) {
      lastPublished.current = next;
      onPublishRef.current(next);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !("geolocation" in navigator)) return;

    const id = navigator.geolocation.watchPosition(
      handle,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermission("denied");
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        // Sem maximumAge: numa viagem, posicao de 30 s atras ja e passado.
        maximumAge: 0,
        timeout: 20_000,
      },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled, handle]);

  return { fix, permission, error };
}
