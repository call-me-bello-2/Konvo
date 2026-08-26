import { cn } from "@/lib/utils";
import type { MemberState } from "@/lib/konvo/types";

/**
 * A identidade visual de uma pessoa dentro do Konvo.
 *
 * Brief §11: participantes sao avatar + cor pessoal, NAO icones genericos de
 * carro. A cor e o que amarra a pessoa entre mapa, lista e eventos — e a mesma
 * em todo lugar, atribuida na ordem de entrada na viagem.
 */

const PALETTE = [
  "var(--color-p1)",
  "var(--color-p2)",
  "var(--color-p3)",
  "var(--color-p4)",
  "var(--color-p5)",
  "var(--color-p6)",
] as const;

export function participantColor(colorIndex: number): string {
  return PALETTE[(colorIndex - 1 + PALETTE.length) % PALETTE.length];
}

const SIZES = {
  sm: { box: "size-8", text: "text-[11px]", ring: 2 },
  md: { box: "size-10", text: "text-[13px]", ring: 2.5 },
  lg: { box: "size-14", text: "text-[17px]", ring: 3 },
} as const;

interface Props {
  name: string;
  colorIndex: number;
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
  /** desenha o anel na cor da pessoa — usado no mapa e na lista do grupo */
  ring?: boolean;
  /** uma letra so; usar em pilhas sobrepostas, onde a segunda fica escondida */
  short?: boolean;
  state?: MemberState;
  className?: string;
}

export function ParticipantAvatar({
  name,
  colorIndex,
  avatarUrl,
  size = "md",
  ring = false,
  short = false,
  state,
  className,
}: Props) {
  const color = participantColor(colorIndex);
  const s = SIZES[size];

  // Quem esta sem sinal aparece esmaecido: a interface nao pode dar a mesma
  // presenca a uma posicao de 5 minutos atras e a uma de agora.
  const dimmed = state === "offline";

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ opacity: dimmed ? 0.45 : 1 }}
    >
      <div
        className={cn(
          s.box,
          "grid place-items-center overflow-hidden rounded-full font-bold text-white",
          s.text,
        )}
        style={{
          backgroundColor: color,
          boxShadow: ring ? `0 0 0 ${s.ring}px var(--color-surface)` : undefined,
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="size-full object-cover" />
        ) : (
          initials(name, short)
        )}
      </div>
    </div>
  );
}

function initials(name: string, short = false): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (short) return parts[0][0].toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
