import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { BottomSheet } from "./BottomSheet";
import { useT } from "@/i18n";

/**
 * Convite (brief §09).
 *
 * O link E a credencial: quem tem o link entra. Por isso o codigo tambem
 * aparece em texto grande — no carro, ditar seis letras em voz alta costuma ser
 * mais rapido do que achar a pessoa no WhatsApp.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripName: string;
  code: string;
}

export function InviteSheet({ open, onOpenChange, tripName, code }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/join/${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Safari sem gesto do usuario recusa; o codigo abaixo continua servindo.
    }
  };

  const share = async () => {
    // Compartilhamento nativo cai direto no WhatsApp, que e onde a familia
    // esta. Onde nao existe, o botao nem aparece.
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: tripName, text: `${tripName} — Konvo`, url });
    } catch {
      // cancelado pelo usuario
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("invite.title")}>
      <div className="rounded-card border border-hairline bg-surface-2 px-4 py-3">
        <p className="break-all font-mono text-[13px] font-semibold text-ink-70">{url}</p>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex h-13 flex-1 items-center justify-center gap-2 rounded-pill bg-surface-2 font-bold text-ink-70 active:bg-surface-3"
          style={{ height: 52 }}
        >
          {copied ? (
            <Check className="size-[19px]" strokeWidth={2.5} />
          ) : (
            <Copy className="size-[19px]" strokeWidth={2.5} />
          )}
          {copied ? t("invite.copied") : t("invite.copy")}
        </button>

        {typeof navigator.share === "function" && (
          <button
            type="button"
            onClick={() => void share()}
            className="flex h-13 flex-1 items-center justify-center gap-2 rounded-pill bg-konvo-500 font-bold text-white active:bg-konvo-600"
            style={{ height: 52 }}
          >
            <Share2 className="size-[19px]" strokeWidth={2.5} />
            {t("invite.share")}
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-[13px] font-semibold text-ink-35">
        {t("invite.code")}
      </p>
      <p className="tnum mt-1 text-center text-[34px] font-extrabold tracking-[0.12em] text-konvo-500">
        {code}
      </p>
    </BottomSheet>
  );
}
