/**
 * Os bipes do radio.
 *
 * Sintetizados no proprio navegador com WebAudio. Nao ha arquivo para baixar,
 * o que importa numa viagem: o som funciona na primeira vez, sem sinal, e sem
 * somar peso ao bundle.
 *
 * Por que ter som: quem esta dirigindo nao olha a tela. O bipe e o unico jeito
 * de confirmar "gravou", "foi" e "chegou recado" sem exigir os olhos. E o
 * mesmo motivo pelo qual radio de verdade apita.
 */

let ctx: AudioContext | null = null;

/**
 * O AudioContext so pode nascer a partir de um gesto do usuario — regra de
 * todos os navegadores modernos. Como o primeiro som sempre vem de um toque no
 * botao de falar, criar aqui, na hora, e o unico momento em que funciona.
 */
function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Beep {
  freq: number;
  /** segundos */
  duration: number;
  /** atraso desde o inicio da sequencia, em segundos */
  at: number;
  gain?: number;
  type?: OscillatorType;
}

function play(beeps: Beep[]) {
  const a = audio();
  if (!a) return;

  const now = a.currentTime;

  for (const b of beeps) {
    const osc = a.createOscillator();
    const vol = a.createGain();

    osc.type = b.type ?? "square";
    osc.frequency.value = b.freq;

    // Envelope curto nas duas pontas: sem isso, ligar e desligar o oscilador
    // produz um estalo — que num fone, no ouvido de quem dirige, e horrivel.
    const start = now + b.at;
    const end = start + b.duration;
    const peak = b.gain ?? 0.16;

    vol.gain.setValueAtTime(0.0001, start);
    vol.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    vol.gain.setValueAtTime(peak, end - 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(vol).connect(a.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

/** Ao apertar: som subindo, "abriu o canal". */
export function beepStart() {
  play([
    { freq: 620, duration: 0.06, at: 0 },
    { freq: 880, duration: 0.09, at: 0.06 },
  ]);
}

/** Ao soltar: o "roger beep" classico, descendo — mensagem encerrada. */
export function beepEnd() {
  play([
    { freq: 880, duration: 0.05, at: 0 },
    { freq: 590, duration: 0.11, at: 0.05 },
  ]);
}

/** Recado chegando: dois toques curtos e agudos, distintos do resto. */
export function beepIncoming() {
  play([
    { freq: 1180, duration: 0.05, at: 0, gain: 0.12 },
    { freq: 1180, duration: 0.05, at: 0.11, gain: 0.12 },
  ]);
}

/** Nao deu para enviar: grave e arrastado, inconfundivelmente negativo. */
export function beepFailed() {
  play([
    { freq: 300, duration: 0.13, at: 0, type: "sawtooth", gain: 0.13 },
    { freq: 190, duration: 0.2, at: 0.13, type: "sawtooth", gain: 0.13 },
  ]);
}

/**
 * Chiado curto de radio.
 *
 * Ruido branco filtrado, tocado junto do bipe. E o detalhe que faz o ouvido
 * reconhecer "isso e um radio" em vez de "isso e uma notificacao de app".
 */
export function staticBurst(duration = 0.09) {
  const a = audio();
  if (!a) return;

  const frames = Math.floor(a.sampleRate * duration);
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = a.createBufferSource();
  src.buffer = buffer;

  // Passa-banda estreito: ruido branco cru soa como televisao fora do ar;
  // filtrado na faixa da voz, soa como radio.
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1600;
  band.Q.value = 0.8;

  const vol = a.createGain();
  const now = a.currentTime;
  vol.gain.setValueAtTime(0.06, now);
  vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(band).connect(vol).connect(a.destination);
  src.start(now);
  src.stop(now + duration);
}

/** Prepara o audio no primeiro toque, para o primeiro bipe nao sair mudo. */
export function primeAudio() {
  audio();
}
