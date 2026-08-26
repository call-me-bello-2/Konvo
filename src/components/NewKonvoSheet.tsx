import { ChevronRight, MapPin, Plus, Route, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { BottomSheet } from "./BottomSheet";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * A folha do botao + — contextual.
 *
 * O + e o controle mais acessivel do app. Durante uma viagem ativa, "criar um
 * segundo Konvo" quase nunca e a intencao: o que a pessoa quer e mexer NA
 * viagem em que ela esta. Entao o conteudo muda; o icone, nao — icone que muda
 * de forma confunde mais do que ajuda.
 *
 * Divergencia consciente do brief §08, que previa sempre a folha de criacao.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** viagem em andamento, quando ha uma */
  activeTrip?: { id: string; name: string } | null;
}

export function NewKonvoSheet({ open, onOpenChange, activeTrip }: Props) {
  const t = useT();
  const navigate = useNavigate();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  if (activeTrip) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={activeTrip.name}>
        <div className="flex flex-col gap-2">
          <ActionRow
            icon={MapPin}
            title={t("new.addStop")}
            copy={t("new.addStopCopy")}
            onClick={() => go(`/konvo/${activeTrip.id}/stop`)}
          />
          <ActionRow
            icon={UserPlus}
            title={t("new.invite")}
            copy={t("new.inviteCopy")}
            onClick={() => go(`/konvo/${activeTrip.id}/invite`)}
          />
        </div>

        <div className="my-4 h-px bg-hairline" />

        {/* Criar outra viagem continua possivel, so deixa de ser o destaque. */}
        <button
          type="button"
          onClick={() => go("/new")}
          className="flex w-full items-center gap-2 rounded-card px-1 py-2 font-bold text-ink-50 active:bg-surface-2"
        >
          <Plus className="size-[18px]" strokeWidth={2.75} />
          {t("new.another")}
        </button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("new.title")}>
      <div className="flex flex-col gap-2.5">
        <ModeCard
          icon={Route}
          title={t("new.together")}
          copy={t("new.togetherCopy")}
          onClick={() => go("/new?mode=together")}
        />
        <ModeCard
          icon={Users}
          title={t("new.meet")}
          copy={t("new.meetCopy")}
          onClick={() => go("/new?mode=meet")}
        />
      </div>
    </BottomSheet>
  );
}

/**
 * Os dois modos do produto (brief §08).
 *
 * O brief e explicito em nao chamar de "Convoy Mode" e "Meet Mode" na
 * interface: para quem usa, sao duas formas de comecar a mesma coisa.
 */
function ModeCard({
  icon: Icon,
  title,
  copy,
  onClick,
}: {
  icon: typeof Route;
  title: string;
  copy: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3.5 rounded-card border border-hairline bg-surface p-4 text-left",
        "shadow-card transition-colors active:bg-konvo-50",
      )}
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-konvo-50 text-konvo-500">
        <Icon className="size-[22px]" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-extrabold leading-tight">{title}</div>
        <div className="mt-0.5 text-[13px] font-semibold text-ink-50">{copy}</div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
    </button>
  );
}

function ActionRow({
  icon: Icon,
  title,
  copy,
  onClick,
}: {
  icon: typeof MapPin;
  title: string;
  copy: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3.5 rounded-card px-1 py-2.5 text-left active:bg-surface-2"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-konvo-50 text-konvo-500">
        <Icon className="size-[21px]" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-extrabold leading-tight">{title}</div>
        <div className="mt-0.5 text-[13px] font-semibold text-ink-50">{copy}</div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
    </button>
  );
}
