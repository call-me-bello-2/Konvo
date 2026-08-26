import { useEffect, useRef, useState } from "react";

/**
 * Mantem a tela acesa durante a viagem.
 *
 * Isto nao e conforto — e o que faz o esquema inteiro funcionar. Navegador nao
 * rastreia GPS em segundo plano: se a tela apaga, `watchPosition` para e o
 * carro some do mapa. Com um celular dedicado por carro na tomada, a Wake Lock
 * e o que garante que ele continue transmitindo a viagem toda.
 *
 * O detalhe que quase todo mundo erra: a trava e liberada automaticamente
 * quando a aba deixa de ser visivel. Sem readquirir no `visibilitychange`, ela
 * funciona ate a primeira vez que a pessoa troca de app — e nunca mais.
 */

export function useWakeLock(enabled: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const [active, setActive] = useState(false);
  const [supported] = useState(() => "wakeLock" in navigator);

  useEffect(() => {
    if (!enabled || !supported) {
      setActive(false);
      return;
    }

    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel.current = lock;
        setActive(true);
        lock.addEventListener("release", () => setActive(false));
      } catch {
        // Bateria fraca faz o iOS recusar. Nao e erro fatal: a viagem continua,
        // so exige que a pessoa nao deixe a tela apagar sozinha.
        setActive(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel.current?.release();
      sentinel.current = null;
    };
  }, [enabled, supported]);

  return { active, supported };
}
