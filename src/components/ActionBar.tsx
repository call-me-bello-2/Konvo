import { Bell, MapPin, Phone } from "lucide-react";

import { TalkButton } from "./TalkButton";
import { useT } from "@/i18n";

/**
 * As acoes do Live Konvo.
 *
 * Regras que vieram do §32 (o app e usado dentro de carro em movimento):
 * - alvos grandes, na parte de baixo, ao alcance do polegar;
 * - uma acao por botao, sem menu dentro de menu;
 * - texto junto do icone — icone sozinho exige decifrar, e ninguem decifra a
 *   100 km/h;
 * - nada de digitacao.
 *
 * A ordem e por frequencia de uso, nao por importancia: falar e o que mais
 * acontece, entao ocupa a linha inteira em cima.
 */

interface Props {
  tripId: string;
  memberId: string | null;
  listenerCount: number;
  onAttention: () => void;
  onCall: () => void;
  onStop: () => void;
  /** no modo demonstracao nao ha microfone nem grupo de verdade */
  demo?: boolean;
}

export function ActionBar({
  tripId,
  memberId,
  listenerCount,
  onAttention,
  onCall,
  onStop,
  demo = false,
}: Props) {
  const t = useT();

  return (
    <div className="flex flex-col gap-2">
      {memberId || demo ? (
        <TalkButton
          demo={demo}
          tripId={tripId}
          memberId={memberId ?? "demo"}
          listenerCount={listenerCount}
          idleLabel={t("live.holdToTalk")}
          sendingLabel={t("live.sending")}
          label={(n) => t("live.talkingTo", { count: n })}
        />
      ) : (
        <div className="grid h-[76px] place-items-center rounded-pill bg-surface-2 text-[16px] font-bold text-ink-35">
          {t("live.holdToTalk")}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {/* Atencao primeiro: e a mais urgente das tres. */}
        <ActionButton
          icon={Bell}
          label={t("live.attention")}
          tone="stretching"
          onClick={onAttention}
        />
        <ActionButton icon={Phone} label={t("live.call")} onClick={onCall} />
        <ActionButton icon={MapPin} label={t("quick.stop")} onClick={onStop} />
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: typeof Bell;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "stretching";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        tone === "stretching"
          ? "flex h-[62px] flex-col items-center justify-center gap-1 rounded-card bg-stretching-soft font-bold text-stretching-ink active:opacity-75"
          : "flex h-[62px] flex-col items-center justify-center gap-1 rounded-card border border-hairline bg-surface font-bold text-ink-70 active:bg-surface-2"
      }
    >
      <Icon className="size-[21px]" strokeWidth={2.25} />
      <span className="text-[12px] leading-none">{label}</span>
    </button>
  );
}
