import { useRef, useState } from "react";
import { Camera } from "lucide-react";

import { ParticipantAvatar } from "./ParticipantAvatar";

/**
 * Foto da pessoa.
 *
 * Numa viagem de familia a foto vale mais do que parece: um rosto no mapa se
 * reconhece instantaneamente, enquanto uma inicial exige lembrar de quem e.
 *
 * A imagem e reduzida a 128 px e guardada como data URL. Isso evita montar
 * upload, bucket e URL assinada so para um retrato de 40 px na tela — e o
 * resultado cabe folgado numa coluna de texto.
 */

const SIZE = 128;
const QUALITY = 0.72;

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  // Recorte quadrado a partir do centro: o avatar e redondo, e cortar nas
  // bordas e melhor do que distorcer o rosto.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", QUALITY);
}

interface Props {
  name: string;
  colorIndex: number;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  size?: "md" | "lg";
}

export function AvatarPicker({ name, colorIndex, value, onChange, size = "lg" }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      className="relative shrink-0"
      aria-label="Foto"
    >
      <ParticipantAvatar
        name={name || "?"}
        colorIndex={colorIndex}
        avatarUrl={value}
        size={size}
        short
      />

      <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full bg-konvo-500 text-white ring-2 ring-canvas">
        <Camera className="size-[13px]" strokeWidth={2.5} />
      </span>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onChange(await shrink(file));
          } catch {
            // Formato que o navegador nao abre: melhor seguir sem foto do que
            // travar a entrada na viagem por causa de um retrato.
          } finally {
            setBusy(false);
          }
        }}
      />
    </button>
  );
}
