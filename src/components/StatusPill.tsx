import { cn } from "@/lib/utils";
import type { GroupStatusKind } from "@/lib/konvo/types";

/**
 * O estado do grupo em uma pilula (brief §11).
 *
 * Verde / amarelo / vermelho, lido de relance por quem esta dirigindo. A cor
 * nunca carrega o significado sozinha: sempre acompanha texto, porque ~8% dos
 * homens nao distingue verde de vermelho — e essa e a informacao mais
 * importante da tela.
 */

type Tone = "together" | "stretching" | "split" | "neutral";

const TONE_OF: Record<GroupStatusKind, Tone> = {
  together: "together",
  arriving: "together",
  arrived: "together",
  regrouping: "stretching",
  stretching: "stretching",
  stopped: "stretching",
  split: "split",
};

const WRAP: Record<Tone, string> = {
  together: "bg-together-soft text-together-ink",
  stretching: "bg-stretching-soft text-stretching-ink",
  split: "bg-split-soft text-split-ink",
  neutral: "bg-surface-3 text-ink-70",
};

const DOT: Record<Tone, string> = {
  together: "bg-together",
  stretching: "bg-stretching",
  split: "bg-split",
  neutral: "bg-ink-35",
};

interface Props {
  kind: GroupStatusKind;
  children: React.ReactNode;
  /** contagem a direita, tipo "5/5" */
  trailing?: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusPill({ kind, children, trailing, size = "md", className }: Props) {
  const tone = TONE_OF[kind];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-pill font-bold",
        size === "md" ? "h-8 px-3 text-[13px]" : "h-7 px-2.5 text-[12px]",
        WRAP[tone],
        className,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} />
      <span className="truncate">{children}</span>
      {trailing && <span className="tnum shrink-0 opacity-70">{trailing}</span>}
    </span>
  );
}
