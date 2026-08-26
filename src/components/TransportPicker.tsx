import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { isRoadBound, type TransportType } from "@/lib/konvo/types";
import type { TranslationKey } from "@/i18n/en";

/**
 * Como a pessoa vai.
 *
 * Quatro opcoes a vista, o resto atras de "Mais".
 *
 * Onze botoes de uma vez cobriam todos os casos e nao servia bem nenhum: quem
 * vai de carro — a esmagadora maioria — tinha que varrer a lista inteira para
 * achar a primeira opcao. Escolher rapido e o objetivo desta tela (§09).
 *
 * As opcoes escondidas nao sao menos importantes, sao menos frequentes. E quem
 * vai de aviao sabe que vai de aviao: procurar um toque a mais nao atrapalha
 * essa pessoa, enquanto poluir atrapalha todo mundo.
 *
 * "Outro" foi removido: sem saber como a pessoa vai, o app nao consegue medir
 * distancia nem dizer se ela esta junto do grupo. Uma opcao que so gera
 * informacao vazia e pior do que nao ter opcao.
 */

const COMMON: TransportType[] = ["car", "motorcycle", "bus", "passenger"];
const MORE: TransportType[] = ["van", "bicycle", "walking", "train", "plane", "boat"];

const LABEL: Record<Exclude<TransportType, "other">, TranslationKey> = {
  car: "transport.car",
  motorcycle: "transport.motorcycle",
  bus: "transport.bus",
  passenger: "transport.passenger",
  van: "transport.van",
  bicycle: "transport.bicycle",
  walking: "transport.walking",
  train: "transport.train",
  plane: "transport.plane",
  boat: "transport.boat",
};

const GLYPH: Record<Exclude<TransportType, "other">, string> = {
  car: "M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11M4 11h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm2.5 5v1.5m11-1.5v1.5",
  motorcycle: "M5.5 16l3.2-5h5l2.5 5M12 11l-1.5-3H8M5.5 12.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Zm13 0a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z",
  bus: "M4 4h16v13H4zM4 10h16M8 17v2m8-2v2",
  passenger: "M12 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM5.5 19a6.5 6.5 0 0 1 13 0",
  van: "M3 6h18v9H3zM14 6v9M7 15v2m10-2v2",
  bicycle: "M5.5 16.5l4-8h4l3 8m-7-8h-2M5.5 13.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Zm13 0a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Z",
  walking: "M12.5 8v5m0 0l-3 6m3-6l3 6M9 10.5l3.5-1.5 3.5 1.5M12.5 2.5a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Z",
  train: "M5 4h14v11H5zM5 10h14M8.5 19l-2 2m9-2l2 2",
  plane: "M10.2 20.5l1.6-5.4 3.4-1.6 5.3 1.4 -3.5-6.3 1.2-4.1-3.6 2.5-4.4-1.4 2.3 3.6-3.4 1.9-3.3-1 2.3 2.5-.6 2.6z",
  boat: "M4 15.5h16l-2.2 4H6.2zM12 15.5V4l5 7H7z",
};

interface Props {
  value: TransportType;
  onChange: (t: TransportType) => void;
}

export function TransportPicker({ value, onChange }: Props) {
  const t = useT();
  // Se a pessoa ja escolheu algo do grupo escondido, ele nasce aberto — senao
  // ela nao veria a propria escolha ao voltar para a tela.
  const [expanded, setExpanded] = useState(() => MORE.includes(value));

  const cell = (type: Exclude<TransportType, "other">) => (
    <button
      key={type}
      type="button"
      onClick={() => onChange(type)}
      className={cn(
        "flex h-[66px] flex-col items-center justify-center gap-1.5 rounded-card border font-bold",
        value === type
          ? "border-konvo-500 bg-konvo-50 text-konvo-500"
          : "border-hairline bg-surface text-ink-50",
      )}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={GLYPH[type]}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[11px] leading-none">{t(LABEL[type])}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        {COMMON.map((c) => cell(c as Exclude<TransportType, "other">))}
      </div>

      {expanded ? (
        <div className="grid grid-cols-4 gap-2">
          {MORE.map((c) => cell(c as Exclude<TransportType, "other">))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-card text-[13px] font-bold text-ink-50 active:bg-surface-2"
        >
          {t("transport.more")}
          <ChevronDown className="size-[15px]" strokeWidth={2.5} />
        </button>
      )}

      {/* Explica a consequencia no momento em que ela passa a valer, e nao
          antes: quem escolheu carro nao precisa ler sobre aviao. */}
      {!isRoadBound(value) && (
        <p className="mt-1 text-[13px] font-semibold leading-snug text-ink-50">
          {t("transport.ownWayNote")}
        </p>
      )}
    </div>
  );
}
