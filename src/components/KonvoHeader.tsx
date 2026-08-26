import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

import { ParticipantAvatar } from "./ParticipantAvatar";
import { useTheme } from "@/theme";
import { cn } from "@/lib/utils";

/**
 * Top bar do app.
 *
 * Wordmark centralizado, esquerda livre, sino + avatar a direita. O wordmark e
 * a arte aprovada com transparencia real — nao um "K" generico (brief §02).
 */

interface Props {
  unreadCount?: number;
  user?: { name: string; colorIndex: number; avatarUrl?: string | null };
  className?: string;
}

export function KonvoHeader({ unreadCount = 0, user, className }: Props) {
  const { resolved } = useTheme();
  // O wordmark e arte de bitmap, nao texto: precisa de uma versao branca para
  // o fundo escuro. As duas saem da mesma arte original.
  const wordmark = resolved === "dark" ? "/brand/wordmark-white.png" : "/brand/wordmark.png";

  return (
    <header
      className={cn(
        "safe-top relative z-20 shrink-0 border-b border-hairline bg-canvas/85 backdrop-blur-sm",
        className,
      )}
    >
      <div className="relative flex h-14 items-center px-4">
        {/* O wordmark fica centrado na tela, nao no espaco que sobra — assim
            nao desliza quando o badge de notificacao aparece ou some. */}
        <Link
          to="/"
          aria-label="Konvo"
          className="absolute left-1/2 -translate-x-1/2 py-2"
        >
          <img
            src={wordmark}
            alt="Konvo"
            width={73}
            height={22}
            className="h-[22px] w-auto"
          />
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/activity"
            aria-label="Activity"
            className="relative grid size-10 place-items-center rounded-full active:bg-surface-2"
          >
            <Bell className="size-[22px] text-ink" strokeWidth={2} />
            {unreadCount > 0 && (
              <span
                className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-split ring-2 ring-canvas"
                aria-label={`${unreadCount} new`}
              />
            )}
          </Link>

          <Link to="/you" aria-label="You" className="ml-0.5">
            {user ? (
              <ParticipantAvatar
                name={user.name}
                colorIndex={user.colorIndex}
                avatarUrl={user.avatarUrl}
                size="sm"
              />
            ) : (
              <div className="size-8 rounded-full bg-surface-3" />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
