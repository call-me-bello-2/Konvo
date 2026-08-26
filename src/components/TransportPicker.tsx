import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { isRoadBound, type TransportType } from "@/lib/konvo/types";
import type { TranslationKey } from "@/i18n/en";

/**
 * Como a pessoa vai.
 *
 * Em duas fileiras, e nao numa lista longa: os transportes de estrada vem
 * primeiro porque sao o caso comum de um comboio. Os de baixo — trem, aviao,
 * barco — seguem caminho proprio, e o app trata a distancia deles em linha reta
 * ate o destino em vez de projetar na rota do grupo (ver `isRoadBound`).
 *
 * "Passageiro" fica junto dos de estrada porque e isso que ele e: alguem dentro
 * do carro de outra pessoa.
 */

const ROAD: TransportType[] = ["car", "motorcycle", "bus", "van", "passenger", "bicycle", "walking"];
const OWN_WAY: TransportType[] = ["train", "plane", "boat", "other"];

const LABEL: Record<TransportType, TranslationKey> = {
  car: "transport.car",
  motorcycle: "transport.motorcycle",
  bus: "transport.bus",
  van: "transport.van",
  passenger: "transport.passenger",
  bicycle: "transport.bicycle",
  walking: "transport.walking",
  train: "transport.train",
  plane: "transport.plane",
  boat: "transport.boat",
  other: "transport.other",
};

const GLYPH: Record<TransportType, string> = {
  car: "M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11M4 11h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm2.5 5v1.5m11-1.5v1.5",
  motorcycle: "M5.5 16l3.2-5h5l2.5 5M12 11l-1.5-3H8",
  bus: "M4 4h16v13H4zM4 10h16M8 17v2m8-2v2",
  van: "M3 6h18v9H3zM14 6v9M7 15v2m10-2v2",
  passenger: "M12 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM5.5 19a6.5 6.5 0 0 1 13 0",
  bicycle: "M5.5 16.5l4-8h4l3 8m-7-8h-2",
  walking: "M12.5 8v5m0 0l-3 6m3-6l3 6M9 10.5l3.5-1.5 3.5 1.5",
  train: "M5 4h14v11H5zM5 10h14M8.5 19l-2 2m9-2l2 2",
  plane: "M10.2 20.5l1.6-5.4 3.4-1.6 5.3 1.4 -3.5-6.3 1.2-4.1-3.6 2.5-4.4-1.4 2.3 3.6-3.4 1.9-3.3-1 2.3 2.5-.6 2.6z",
  boat: "M4 15.5h16l-2.2 4H6.2zM12 15.5V4l5 7H7z",
  other: "M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z",
};

interface Props {
  value: TransportType;
  onChange: (t: TransportType) => void;
}

export function TransportPicker({ value, onChange }: Props) {
  const t = useT();

  const cell = (type: TransportType) => (
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
      <div className="grid grid-cols-4 gap-2">{ROAD.map(cell)}</div>
      <div className="grid grid-cols-4 gap-2">{OWN_WAY.map(cell)}</div>

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
