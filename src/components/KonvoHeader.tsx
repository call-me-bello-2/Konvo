import { Bell, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";

/**
 * Top bar do app.
 *
 * Wordmark centralizado, `+` a esquerda, sino a direita. Tres elementos e o
 * teto: cada coisa a mais aqui compete com o wordmark e a barra deixa de ser
 * identidade para virar painel de controle.
 *
 * Sem avatar de proposito — ele nao fazia nada que a aba "Você" ja nao faca, e
 * ocupava o mesmo canto que o sino: dois alvos colados, um deles inutil.
 */

interface Props {
  unreadCount?: number;
  onNewKonvo?: () => void;
  /** abre as notificacoes em folha, sem trocar de tela */
  onNotifications?: () => void;
  className?: string;
}

export function KonvoHeader({ unreadCount = 0, onNewKonvo, onNotifications, className }: Props) {
  const t = useT();
  const { resolved } = useTheme();

  // O wordmark e arte de bitmap, nao texto: precisa de uma versao branca para
  // o fundo escuro. As duas saem da mesma arte original.
  const wordmark = resolved === "dark" ? "/brand/wordmark-white.png" : "/brand/wordmark.png";

  return (
    <header
      className={cn(
        // Sem borda e na mesma cor da tela: a barra deixa de ser um bloco separado
        // e o conteudo parece continuar por baixo dela.
        "safe-top relative z-20 shrink-0 bg-canvas",
        className,
      )}
    >
      <div className="relative flex h-14 items-center px-2">
        <button
          type="button"
          onClick={onNewKonvo}
          aria-label={t("nav.new")}
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink active:bg-surface-2"
        >
          <Plus className="size-[23px]" strokeWidth={2.5} />
        </button>

        {/* O wordmark fica centrado na TELA, nao no espaco que sobra — assim
            nao desliza quando o badge de notificacao aparece ou some. */}
        <Link to="/" aria-label="Konvo" className="absolute left-1/2 -translate-x-1/2 py-2">
          <img
            src={wordmark}
            alt="Konvo"
            width={73}
            height={22}
            className="h-[22px] w-auto"
          />
        </Link>

        <button
          type="button"
          onClick={onNotifications}
          aria-label={t("notif.title")}
          className="relative ml-auto grid size-10 shrink-0 place-items-center rounded-full active:bg-surface-2"
        >
          <Bell className="size-[22px] text-ink" strokeWidth={2} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-split ring-2 ring-canvas" />
          )}
        </button>
      </div>
    </header>
  );
}
