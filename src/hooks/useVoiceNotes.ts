import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import { voiceNoteUrl } from "@/lib/db/voice";
import { beepIncoming, staticBurst } from "@/lib/audio/radioSounds";

/**
 * Recebe e toca os recados de voz do grupo.
 *
 * Autoplay e o ponto: quem esta dirigindo nao vai tocar na tela para ouvir. O
 * recado chega e sai no alto-falante, como um radio — que e o que o brief §16
 * pede.
 *
 * Fila em serie, nao simultanea: dois recados tocando junto viram ruido.
 */

interface VoiceNoteRow {
  id: string;
  trip_id: string;
  member_id: string | null;
  storage_path: string;
  duration_ms: number | null;
}

export function useVoiceNotes(
  tripId: string | undefined,
  myMemberId: string | null,
  nameOf: (memberId: string | null) => string,
) {
  /** nome de quem esta tocando agora, para o aviso "Fulano está falando…" */
  const [speaking, setSpeaking] = useState<string | null>(null);
  const queue = useRef<{ url: string; name: string }[]>([]);
  const playing = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const playNext = useCallback(() => {
    const next = queue.current.shift();
    if (!next) {
      playing.current = false;
      setSpeaking(null);
      return;
    }

    playing.current = true;
    setSpeaking(next.name);

    // Bipe antes da voz: da meio segundo para quem esta dirigindo entender que
    // vem recado, em vez de a voz comecar do nada no meio do transito.
    beepIncoming();
    staticBurst(0.08);

    const el = audio.current ?? new Audio();
    audio.current = el;
    el.src = next.url;
    el.onended = playNext;
    el.onerror = playNext;

    // Espera o bipe terminar antes de soltar a voz.
    setTimeout(() => {
      void el.play().catch(() => {
        // Alguns navegadores exigem um gesto do usuario antes do primeiro som.
        // Depois que a pessoa tocar em qualquer coisa na tela, passa a funcionar.
        playNext();
      });
    }, 260);
  }, []);

  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel(`voice:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "voice_notes",
          filter: `trip_id=eq.${tripId}`,
        },
        ({ new: row }) => {
          const note = row as VoiceNoteRow;
          // O proprio recado nao volta para quem mandou.
          if (note.member_id && note.member_id === myMemberId) return;

          void voiceNoteUrl(note.storage_path).then((url) => {
            if (!url) return;
            queue.current.push({ url, name: nameOf(note.member_id) });
            if (!playing.current) playNext();
          });
        },
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
      audio.current?.pause();
      queue.current = [];
      playing.current = false;
      setSpeaking(null);
    };
  }, [tripId, myMemberId, nameOf, playNext]);

  return { speaking };
}
