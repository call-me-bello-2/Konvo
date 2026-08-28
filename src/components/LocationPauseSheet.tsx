import { EyeOff } from "lucide-react";

import { BottomSheet } from "./BottomSheet";
import { useT } from "@/i18n";

/**
 * Pausar a localizacao.
 *
 * Existe por privacidade, nao por jogo: alguem desvia para resolver uma coisa
 * pessoal e nao quer o grupo acompanhando. Sem isso a unica saida seria fechar
 * o app — e aí o carro some do mapa sem explicacao, que e pior para todo mundo.
 *
 * Duas decisoes que separam isto de um "modo fantasma" de jogo:
 *
 * 1. O grupo SABE. Aparece "localizacao pausada", nunca uma posicao velha
 *    disfarcada de atual. Esconder que alguem se escondeu seria mentir com a
 *    interface.
 *
 * 2. Nao ha penalidade nem limite de uso. Numa competicao, sumir e vantagem e
 *    precisa de trava. Numa viagem em familia, sumir e um pedido de espaco.
 *
 * A pausa sempre expira sozinha. Ninguem lembra de religar, e o custo de
 * esquecer — o grupo achar que voce sumiu na estrada — e alto demais.
 */

const OPTIONS = [5, 15, 60] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** minutos restantes, quando ja esta pausado */
  pausedMinutes: number | null;
  onPause: (minutes: number) => void;
  onResume: () => void;
}

export function LocationPauseSheet({
  open,
  onOpenChange,
  pausedMinutes,
  onPause,
  onResume,
}: Props) {
  const t = useT();

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("ghost.title")}
      description={t("ghost.copy")}
    >
      {pausedMinutes !== null ? (
        <>
          <div className="flex items-center gap-3 rounded-card bg-stretching-soft px-4 py-3.5 text-stretching-ink">
            <EyeOff className="size-5 shrink-0" strokeWidth={2.25} />
            <span className="text-[15px] font-bold">
              {t("ghost.pausedFor", { minutes: pausedMinutes })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onResume();
              onOpenChange(false);
            }}
            className="mt-3 w-full rounded-pill bg-konvo-500 font-extrabold text-white active:bg-konvo-600"
            style={{ height: 52 }}
          >
            {t("ghost.resume")}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => {
                onPause(minutes);
                onOpenChange(false);
              }}
              className="flex items-center justify-between rounded-card border border-hairline bg-surface px-4 text-left font-bold active:bg-surface-2"
              style={{ height: 56 }}
            >
              {t("ghost.forMinutes", { minutes })}
              <EyeOff className="size-[18px] text-ink-35" strokeWidth={2.25} />
            </button>
          ))}

          <p className="mt-2 text-[13px] font-semibold leading-snug text-ink-50">
            {t("ghost.groupSees")}
          </p>
        </div>
      )}
    </BottomSheet>
  );
}
