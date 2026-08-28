import { Crosshair, Users } from "lucide-react";

import { ParticipantAvatar } from "./ParticipantAvatar";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/lib/konvo/types";

/**
 * Os participantes na lateral do mapa.
 *
 * Resolve o problema de ter cinco ou dez pessoas ao mesmo tempo sem entulhar o
 * mapa: em vez de procurar o pino de alguem, a pessoa esta sempre ali na borda,
 * e um toque leva a camera ate ela.
 *
 * O anel de cada avatar repete a cor do estado do marcador. Assim da para
 * varrer a coluna e ver quem esta bem e quem nao esta sem olhar o mapa —
 * util justamente quando o mapa esta cheio.
 *
 * Fica na direita porque e onde o polegar alcanca segurando o celular com uma
 * mao so, que e como ele vai ser usado no carro.
 */

function ringColor(v: Vehicle): string {
  switch (v.state) {
    case "arrived":
    case "on_route":
    case "ahead":
      return "var(--color-together)";
    case "behind":
      return v.behindByS > 360 ? "var(--color-split)" : "var(--color-stretching)";
    case "stopped":
    case "off_route":
      return "var(--color-stretching)";
    case "offline":
      return "var(--color-ink-35)";
    default:
      return "var(--color-together)";
  }
}

interface Props {
  vehicles: Vehicle[];
  selectedId: string | null;
  meId: string | null;
  onSelect: (id: string | null) => void;
  /** enquadra o comboio inteiro */
  onOverview: () => void;
  /** volta a camera para o proprio usuario */
  onFollowMe: () => void;
}

export function ParticipantRail({
  vehicles,
  selectedId,
  meId,
  onSelect,
  onOverview,
  onFollowMe,
}: Props) {
  const t = useT();

  // Da frente para tras: a ordem na coluna espelha a ordem na estrada, entao
  // a posicao de alguem na lista ja diz alguma coisa.
  const ordered = [...vehicles].sort((a, b) => a.behindByM - b.behindByM);

  return (
    <div className="pointer-events-none absolute inset-y-0 right-1 flex flex-col items-end justify-center gap-2 py-14">
      {/* O padding horizontal aqui NAO e estetico: o anel do avatar e desenhado
          por box-shadow, que nao ocupa largura, e `overflow-y-auto` clipa os
          dois eixos (regra do CSS — nao existe um eixo `auto` e o outro
          `visible`). Sem folga maior que o anel, ele e cortado. */}
      <div className="pointer-events-auto flex max-h-[44dvh] flex-col gap-3 overflow-y-auto px-2.5 py-2">
        {ordered.map((v) => {
          const person = v.source ?? v.driver;
          const selected = v.id === selectedId;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(selected ? null : v.id)}
              aria-label={v.driver.displayName}
              aria-pressed={selected}
              className={cn(
                "relative shrink-0 rounded-full transition-transform",
                selected ? "scale-110" : "active:scale-95",
              )}
              style={{ opacity: v.state === "offline" ? 0.5 : 1 }}
            >
              <span
                className="block rounded-full"
                style={{
                  boxShadow: `0 0 0 2.5px ${ringColor(v)}, 0 0 0 ${selected ? 5 : 4}px var(--color-surface), 0 2px 6px rgb(0 0 0 / .35)`,
                }}
              >
                <ParticipantAvatar
                  name={person.displayName}
                  colorIndex={v.driver.colorIndex}
                  avatarUrl={person.avatarUrl}
                  size="md"
                  short
                />
              </span>

              {v.id === meId && (
                <span className="absolute -bottom-0.5 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-konvo-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Camera: ver todo mundo, ou voltar para mim. */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <RailButton label={t("live.overview")} onClick={onOverview}>
          <Users className="size-[19px]" strokeWidth={2.25} />
        </RailButton>
        <RailButton label={t("live.followMe")} onClick={onFollowMe}>
          <Crosshair className="size-[19px]" strokeWidth={2.25} />
        </RailButton>
      </div>
    </div>
  );
}

function RailButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full bg-surface/95 text-ink shadow-card backdrop-blur active:bg-surface-2"
    >
      {children}
    </button>
  );
}
