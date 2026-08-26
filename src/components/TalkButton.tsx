import { useCallback, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

import { isRecordingSupported, sendVoiceNote, startRecording, type Recording } from "@/lib/db/voice";
import { cn } from "@/lib/utils";

/**
 * "Segure para falar" (brief §16).
 *
 * Alvo de toque grande e uma acao so: quem esta dirigindo nao vai mirar em
 * botao pequeno. Solta e o recado vai — sem confirmar, sem escolher para quem.
 *
 * Recado muito curto e descartado: quase sempre e toque acidental, e mandar
 * meio segundo de ruido para o grupo inteiro so atrapalha.
 */

const MIN_MS = 700;

interface Props {
  tripId: string;
  memberId: string;
  listenerCount: number;
  label: (n: number) => string;
  idleLabel: string;
}

export function TalkButton({ tripId, memberId, listenerCount, label, idleLabel }: Props) {
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(false);
  const rec = useRef<Recording | null>(null);
  const supported = isRecordingSupported();

  const begin = useCallback(async () => {
    if (!supported || rec.current) return;
    try {
      rec.current = await startRecording();
      setRecording(true);
      setDenied(false);
      // Vibrar confirma que gravou sem exigir olhar para a tela.
      navigator.vibrate?.(15);
    } catch {
      setDenied(true);
    }
  }, [supported]);

  const end = useCallback(async () => {
    const r = rec.current;
    rec.current = null;
    setRecording(false);
    if (!r) return;

    const { blob, durationMs } = await r.stop();
    if (durationMs < MIN_MS || blob.size === 0) return;

    setSending(true);
    try {
      await sendVoiceNote(tripId, memberId, blob, durationMs);
      navigator.vibrate?.([10, 40, 10]);
    } catch {
      // Sem sinal agora: o recado se perde. Melhor isso do que fingir que foi.
      navigator.vibrate?.(200);
    } finally {
      setSending(false);
    }
  }, [tripId, memberId]);

  if (!supported) return null;

  return (
    <button
      type="button"
      disabled={sending}
      onPointerDown={(e) => {
        e.preventDefault();
        void begin();
      }}
      onPointerUp={() => void end()}
      // Sem isto, arrastar o dedo para fora deixa a gravacao presa para sempre.
      onPointerLeave={() => recording && void end()}
      onPointerCancel={() => recording && void end()}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "flex h-14 flex-1 select-none items-center justify-center gap-2.5 rounded-pill",
        "text-[16px] font-extrabold transition-colors",
        recording
          ? "bg-split text-white"
          : denied
            ? "bg-surface-2 text-ink-35"
            : "bg-konvo-500 text-white active:bg-konvo-600",
      )}
      style={{ touchAction: "none" }}
    >
      {denied ? (
        <>
          <MicOff className="size-[21px]" strokeWidth={2.5} />
          {idleLabel}
        </>
      ) : (
        <>
          <Mic className={cn("size-[21px]", recording && "animate-pulse")} strokeWidth={2.5} />
          {recording ? label(listenerCount) : idleLabel}
        </>
      )}
    </button>
  );
}
