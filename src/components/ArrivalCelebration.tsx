import { useEffect, useState } from "react";

import { useT } from "@/i18n";

/**
 * Chegada.
 *
 * O unico momento do app que merece comemorar — e por isso e o unico com
 * animacao de destaque. Se cada acao tivesse a sua, esta nao significaria nada.
 *
 * Sem pontos, medalhas ou nivel: o brief §35 e explicito em nao gamificar, e
 * §23 pede que a conclusao seja elegante, nao festiva. O que se comemora aqui
 * e um fato — voces chegaram, e chegaram juntos.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  destination: string;
  /** fracao da viagem em que o grupo esteve junto, 0 a 1 */
  togetherRatio?: number | null;
}

export function ArrivalCelebration({ open, onClose, destination, togetherRatio }: Props) {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShow(true);
    navigator.vibrate?.([30, 60, 30, 60, 120]);
  }, [open]);

  if (!open || !show) return null;

  const percent =
    togetherRatio === null || togetherRatio === undefined
      ? null
      : Math.round(togetherRatio * 100);

  return (
    <div className="animate-fade fixed inset-0 z-50 grid place-items-center bg-canvas px-8 text-center">
      <div>
        <ChevronBurst />

        <h1 className="animate-pop mt-7 text-[32px] font-extrabold leading-tight tracking-[-0.02em]">
          {t("arrive.title")}
        </h1>
        <p className="mt-1.5 text-[18px] font-bold text-konvo-500">{destination}</p>

        {percent !== null && (
          <p className="mt-4 text-[15px] font-semibold text-ink-50">
            {t("arrive.together", { percent })}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-10 h-14 w-full rounded-pill bg-konvo-500 text-[16px] font-extrabold text-white active:bg-konvo-600"
        >
          {t("arrive.done")}
        </button>
      </div>
    </div>
  );
}

/**
 * O chevron da marca em movimento (brief §34): `<` `<<` `<<<` comunica seguir e
 * progredir. Aqui ele completa o gesto — a viagem terminou.
 */
function ChevronBurst() {
  return (
    <svg
      width="132"
      height="62"
      viewBox="0 0 132 62"
      fill="none"
      className="mx-auto"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M${14 + i * 30} 12 L${40 + i * 30} 31 L${14 + i * 30} 50`}
          stroke="var(--color-konvo-500)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: `konvo-chevron 1.4s ${i * 0.12}s ease-in-out infinite`,
          }}
        />
      ))}
    </svg>
  );
}
