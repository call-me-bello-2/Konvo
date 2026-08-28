import { Check, Flag, MapPin } from "lucide-react";

import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { CheckpointProgress } from "@/lib/konvo/checkpoints";

/**
 * A fita de checkpoints.
 *
 * Uma linha horizontal com os pontos combinados do caminho, mostrando quantos
 * ja chegaram em cada um. Fica no topo do mapa porque responde a pergunta que
 * vem antes de "onde esta cada um?": "podemos seguir?".
 *
 * So aparece quando ha checkpoints. Uma faixa vazia ocupando espaco no mapa
 * seria pior do que faixa nenhuma.
 */

interface Props {
  progress: CheckpointProgress[];
  totalActive: number;
  onFocus?: (checkpointId: string) => void;
}

export function CheckpointStrip({ progress, totalActive, onFocus }: Props) {
  const t = useT();
  if (progress.length === 0) return null;

  return (
    <div className="pointer-events-auto flex gap-2 overflow-x-auto px-3 py-2">
      {progress.map(({ checkpoint, arrivedIds, complete, isNext }) => (
        <button
          key={checkpoint.id}
          type="button"
          onClick={() => onFocus?.(checkpoint.id)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-pill px-3 py-2 shadow-card backdrop-blur",
            complete
              ? "bg-together-soft text-together-ink"
              : isNext
                ? "bg-konvo-500 text-white"
                : "bg-surface/95 text-ink-50",
          )}
        >
          {complete ? (
            <Check className="size-[15px] shrink-0" strokeWidth={3} />
          ) : isNext ? (
            <Flag className="size-[15px] shrink-0" strokeWidth={2.5} />
          ) : (
            <MapPin className="size-[15px] shrink-0" strokeWidth={2.5} />
          )}

          <span className="max-w-[120px] truncate text-[13px] font-extrabold">
            {checkpoint.name}
          </span>

          {/* A contagem e o dado que importa: "2/4" diz na hora se da para
              seguir ou se ainda falta gente. */}
          <span className="tnum shrink-0 text-[12px] font-bold opacity-80">
            {complete ? t("checkpoint.allHere") : `${arrivedIds.length}/${totalActive}`}
          </span>
        </button>
      ))}
    </div>
  );
}
