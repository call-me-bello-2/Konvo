import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

import {
  beepEnd,
  beepFailed,
  beepStart,
  primeAudio,
  staticBurst,
} from "@/lib/audio/radioSounds";
import { isRecordingSupported, sendVoiceNote, startRecording, type Recording } from "@/lib/db/voice";
import { cn } from "@/lib/utils";

/**
 * "Segure para falar" — o walkie-talkie (brief §16).
 *
 * Botao grande de proposito: e o controle mais usado da tela mais usada, e
 * quem o aperta esta dirigindo. Alvo pequeno aqui seria perigoso.
 *
 * Tres confirmacoes acontecem sem exigir os olhos:
 *   - bipe de abertura ao apertar
 *   - vibracao curta
 *   - aneis que pulsam no ritmo da propria voz
 *
 * Gravacao curta demais e descartada: quase sempre e toque acidental, e mandar
 * meio segundo de ruido de estrada para o grupo inteiro so atrapalha.
 */

const MIN_MS = 700;

interface Props {
  tripId: string;
  memberId: string;
  listenerCount: number;
  label: (n: number) => string;
  idleLabel: string;
  sendingLabel?: string;
  /**
   * Modo demonstracao: grava, apita e anima igual, mas nao envia nada. Serve
   * para experimentar o walkie-talkie sem ter uma viagem de verdade aberta —
   * que e exatamente o que a tela /demo existe para permitir.
   */
  demo?: boolean;
}

export function TalkButton({
  tripId,
  memberId,
  listenerCount,
  label,
  idleLabel,
  sendingLabel,
  demo = false,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(false);
  /** 0 a 1 — o quao alto a pessoa esta falando agora */
  const [level, setLevel] = useState(0);

  const rec = useRef<Recording | null>(null);
  const meter = useRef<{ stop: () => void } | null>(null);
  const supported = isRecordingSupported();

  useEffect(() => () => meter.current?.stop(), []);

  const begin = useCallback(async () => {
    if (!supported || rec.current) return;

    // O AudioContext precisa nascer dentro do gesto; aqui e o unico lugar onde
    // isso e garantido.
    primeAudio();

    try {
      rec.current = await startRecording();
      setRecording(true);
      setDenied(false);

      beepStart();
      staticBurst(0.07);
      navigator.vibrate?.(18);

      meter.current = startMeter(setLevel);
    } catch {
      setDenied(true);
      beepFailed();
    }
  }, [supported]);

  const end = useCallback(async () => {
    const r = rec.current;
    rec.current = null;
    setRecording(false);
    meter.current?.stop();
    meter.current = null;
    setLevel(0);
    if (!r) return;

    const { blob, durationMs } = await r.stop();

    if (durationMs < MIN_MS || blob.size === 0) {
      // Toque acidental: nao manda, e nao apita como se tivesse mandado.
      return;
    }

    beepEnd();

    if (demo) {
      navigator.vibrate?.([10, 40, 10]);
      return;
    }

    setSending(true);
    try {
      await sendVoiceNote(tripId, memberId, blob, durationMs);
      navigator.vibrate?.([10, 40, 10]);
    } catch {
      // Sem sinal agora: o recado se perde. Melhor dizer do que fingir que foi.
      beepFailed();
      navigator.vibrate?.(220);
    } finally {
      setSending(false);
    }
  }, [tripId, memberId, demo]);

  if (!supported) return null;

  const busy = recording || sending;

  return (
    <button
      type="button"
      disabled={sending}
      onPointerDown={(e) => {
        e.preventDefault();
        void begin();
      }}
      onPointerUp={() => void end()}
      // Sem isto, arrastar o dedo para fora deixaria a gravacao presa aberta.
      onPointerLeave={() => recording && void end()}
      onPointerCancel={() => recording && void end()}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative flex h-[76px] w-full select-none items-center justify-center gap-3",
        "rounded-pill text-[17px] font-extrabold transition-colors duration-150",
        denied
          ? "bg-surface-2 text-ink-35"
          : recording
            ? "bg-split text-white"
            : "bg-konvo-500 text-white active:bg-konvo-600",
      )}
      style={{ touchAction: "none" }}
    >
      {/* Aneis que respiram com a voz: confirmam que o microfone esta captando
          de verdade, e nao so que o botao foi apertado. */}
      {recording && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-pill bg-white/25"
            style={{ transform: `scale(${1 + level * 0.05})`, transition: "transform 90ms linear" }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-2 rounded-pill border-2 border-split"
            style={{ opacity: 0.25 + level * 0.6, transition: "opacity 120ms linear" }}
          />
        </>
      )}

      <span className="relative grid size-11 place-items-center rounded-full bg-white/20">
        {denied ? (
          <MicOff className="size-6" strokeWidth={2.5} />
        ) : (
          <Mic className="size-6" strokeWidth={2.5} />
        )}
      </span>

      <span className="relative">
        {denied
          ? idleLabel
          : sending
            ? (sendingLabel ?? idleLabel)
            : busy
              ? label(listenerCount)
              : idleLabel}
      </span>
    </button>
  );
}

/**
 * Mede o volume do microfone para animar os aneis.
 *
 * Fluxo separado do gravador de proposito: mexer no stream que esta sendo
 * gravado arriscaria o audio, e o medidor e enfeite — nunca pode por o recado
 * em risco.
 */
function startMeter(onLevel: (v: number) => void) {
  let raf = 0;
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let alive = true;

  void navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((s) => {
      if (!alive) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        onLevel(Math.min(1, peak * 2.2));
        raf = requestAnimationFrame(tick);
      };
      tick();
    })
    .catch(() => {});

  return {
    stop() {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      onLevel(0);
    },
  };
}
