/**
 * Recados de voz — o "walkie-talkie" do brief §16.
 *
 * Grava, sobe, avisa por realtime, toca sozinho nos outros. Nao e chamada:
 * ninguem atende, ninguem fica esperando. E o padrao Zello/Voxer, que e o que
 * o §16 descreve, e tem uma vantagem decisiva na estrada — uma chamada morre
 * quando o sinal oscila; um recado sobe quando der e toca quando chegar.
 */

import { supabase } from "@/lib/supabase";

const BUCKET = "voice-notes";

/** O formato que o navegador aceita gravar varia bastante entre iOS e Android. */
function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
}

export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export interface Recording {
  stop: () => Promise<{ blob: Blob; durationMs: number }>;
  cancel: () => void;
}

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      // Dentro do carro o ruido de estrada e constante e alto; sem isto o
      // recado sai abafado.
      autoGainControl: true,
    },
  });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  const startedAt = Date.now();

  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  recorder.start();

  const release = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          release();
          resolve({
            blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
            durationMs: Date.now() - startedAt,
          });
        };
        recorder.stop();
      }),
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        // ja parado
      }
      release();
    },
  };
}

export async function sendVoiceNote(
  tripId: string,
  memberId: string,
  blob: Blob,
  durationMs: number,
): Promise<void> {
  const ext = blob.type.includes("mp4") || blob.type.includes("aac") ? "m4a" : "webm";
  // O caminho comeca com o id da viagem — e o que amarra a permissao do
  // arquivo a participacao na viagem, no RLS do Storage.
  const path = `${tripId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (upErr) throw upErr;

  const { error } = await supabase.from("voice_notes").insert({
    trip_id: tripId,
    member_id: memberId,
    storage_path: path,
    duration_ms: durationMs,
  });
  if (error) throw error;
}

/** URL temporaria para tocar. O bucket e privado: recado e conversa de familia. */
export async function voiceNoteUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
