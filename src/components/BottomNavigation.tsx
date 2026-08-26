import { Activity, Home, Plus, Route, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/en";

/**
 * Navegacao principal — 5 posicoes (brief §06).
 *
 * O botao central usa o mesmo squircle do icone do app, em Electric Blue.
 * Fica DENTRO da barra, na mesma altura dos outros: o brief pede que seja
 * distinto sem ser enorme, e um FAB flutuante roubaria a atencao do mapa
 * justamente na tela onde ela nao pode ser roubada.
 */

interface Props {
  onNewKonvo: () => void;
}

const TABS: { to: string; icon: typeof Home; label: TranslationKey }[] = [
  { to: "/", icon: Home, label: "nav.home" },
  { to: "/trips", icon: Route, label: "nav.trips" },
];

const TABS_RIGHT: { to: string; icon: typeof Home; label: TranslationKey }[] = [
  { to: "/activity", icon: Activity, label: "nav.activity" },
  { to: "/you", icon: User, label: "nav.you" },
];

export function BottomNavigation({ onNewKonvo }: Props) {
  const t = useT();
  const { pathname } = useLocation();

  return (
    <nav className="safe-bottom relative z-20 shrink-0 border-t border-hairline bg-surface">
      <div className="flex h-[58px] items-stretch">
        {TABS.map((tab) => (
          <Tab key={tab.to} {...tab} active={isActive(pathname, tab.to)} label={t(tab.label)} />
        ))}

        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onNewKonvo}
            aria-label={t("nav.new")}
            className="grid size-[46px] place-items-center rounded-[15px] bg-konvo-500 text-white shadow-fab transition-transform active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.75} />
          </button>
        </div>

        {TABS_RIGHT.map((tab) => (
          <Tab key={tab.to} {...tab} active={isActive(pathname, tab.to)} label={t(tab.label)} />
        ))}
      </div>
    </nav>
  );
}

function isActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function Tab({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  active: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-[3px] pt-1",
        active ? "text-konvo-500" : "text-ink-35",
      )}
    >
      <Icon className="size-[21px]" strokeWidth={active ? 2.5 : 2} />
      <span className={cn("text-[10px] leading-none", active ? "font-bold" : "font-semibold")}>
        {label}
      </span>
    </NavLink>
  );
}
