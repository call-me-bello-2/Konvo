import { Backpack, Home, Plus, Radio, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/en";

/**
 * Navegacao principal — 5 posicoes (brief §06).
 *
 * O botao central e um circulo que flutua acima da barra. Ele nao e "mais um
 * item": e a acao que cria tudo que existe no app, e a forma redonda separa
 * acao de navegacao — os outros quatro levam a algum lugar, este faz alguma
 * coisa.
 *
 * Mochila para Viagens e radio para a aba de conversa: os dois se reconhecem
 * sem legenda, que e o que um icone precisa fazer.
 */

interface Props {
  onNewKonvo: () => void;
  /** nao lidas na aba de conversa */
  unreadCount?: number;
}

const LEFT: { to: string; icon: typeof Home; label: TranslationKey }[] = [
  { to: "/", icon: Home, label: "nav.home" },
  { to: "/trips", icon: Backpack, label: "nav.trips" },
];

const RIGHT: { to: string; icon: typeof Home; label: TranslationKey }[] = [
  { to: "/activity", icon: Radio, label: "nav.inbox" },
  { to: "/you", icon: User, label: "nav.you" },
];

export function BottomNavigation({ onNewKonvo, unreadCount = 0 }: Props) {
  const t = useT();
  const { pathname } = useLocation();

  return (
    <nav className="safe-bottom relative z-20 shrink-0 border-t border-hairline bg-surface">
      <div className="flex h-[60px] items-stretch">
        {LEFT.map((tab) => (
          <Tab key={tab.to} {...tab} active={isActive(pathname, tab.to)} label={t(tab.label)} />
        ))}

        {/* O botao sobe alem da barra: e o unico elemento do app com esse
            direito, e e o que o torna inconfundivel. */}
        <div className="relative flex w-[76px] shrink-0 justify-center">
          <button
            type="button"
            onClick={onNewKonvo}
            aria-label={t("nav.new")}
            className="absolute -top-5 grid size-[58px] place-items-center rounded-full bg-konvo-500 text-white shadow-fab transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.75} />
          </button>
        </div>

        {RIGHT.map((tab) => (
          <Tab
            key={tab.to}
            {...tab}
            active={isActive(pathname, tab.to)}
            label={t(tab.label)}
            badge={tab.to === "/activity" ? unreadCount : 0}
          />
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
  badge = 0,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-[3px] pt-1",
        active ? "text-konvo-500" : "text-ink-35",
      )}
    >
      <span className="relative">
        <Icon className="size-[22px]" strokeWidth={active ? 2.5 : 2} />
        {badge > 0 && (
          <span className="absolute -right-2 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-split px-1 text-[10px] font-extrabold text-white ring-2 ring-surface">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className={cn("text-[10px] leading-none", active ? "font-bold" : "font-semibold")}>
        {label}
      </span>
    </NavLink>
  );
}
