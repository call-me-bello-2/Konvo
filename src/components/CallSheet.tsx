import { Phone } from "lucide-react";

import { BottomSheet } from "./BottomSheet";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { useT } from "@/i18n";
import type { DerivedMember } from "@/lib/konvo/types";

/**
 * Ligar para alguem do grupo.
 *
 * Este e o plano B do produto inteiro: se o app travar, ficar sem sinal ou a
 * bateria acabar, o telefone ainda funciona. Numa estrada, ter esse caminho a
 * um toque importa mais do que qualquer recurso sofisticado.
 *
 * Usa `tel:`, entao quem disca e o proprio sistema — o Konvo nunca vê nem
 * manipula a ligacao.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: (DerivedMember & { phone?: string | null })[];
  /** nao mostra o proprio usuario na lista */
  meId?: string | null;
}

export function CallSheet({ open, onOpenChange, members, meId }: Props) {
  const t = useT();
  const others = members.filter((m) => m.id !== meId);
  const withPhone = others.filter((m) => m.phone);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("live.call")}>
      {withPhone.length === 0 ? (
        <p className="py-4 text-center text-[14px] font-semibold text-ink-50">
          {t("live.callNobody")}
        </p>
      ) : null}

      <div className="flex flex-col">
        {others.map((m) => {
          const disabled = !m.phone;
          const Row = disabled ? "div" : "a";

          return (
            <Row
              key={m.id}
              {...(disabled ? {} : { href: `tel:${m.phone}` })}
              className={
                "flex items-center gap-3 border-b border-hairline py-3.5 last:border-0 " +
                (disabled ? "opacity-45" : "active:bg-surface-2")
              }
            >
              <ParticipantAvatar
                name={m.displayName}
                colorIndex={m.colorIndex}
                size="md"
                short
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold">{m.displayName}</div>
                <div className="truncate text-[13px] font-semibold text-ink-50">
                  {m.phone ?? t("live.noPhone")}
                </div>
              </div>
              {!disabled && (
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-together-soft text-together-ink">
                  <Phone className="size-[18px]" strokeWidth={2.5} />
                </div>
              )}
            </Row>
          );
        })}
      </div>
    </BottomSheet>
  );
}
