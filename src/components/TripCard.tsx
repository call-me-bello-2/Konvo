import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { StatusPill } from "./StatusPill";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { GroupStatusKind } from "@/lib/konvo/types";

/**
 * Card de viagem na lista (brief §19).
 *
 * Tres pesos visuais, porque as tres secoes nao merecem a mesma atencao: a
 * ativa e a unica que importa agora, a proxima e a que vai ser mexida, e a
 * passada e arquivo.
 */

interface Props {
  to: string;
  name: string;
  /** linha de apoio: "Amanhã · 18:00 · 8 pessoas" ou "6 pessoas · 183 km" */
  detail: string;
  variant?: "active" | "upcoming" | "past";
  status?: { kind: GroupStatusKind; label: string };
}

export function TripCard({ to, name, detail, variant = "upcoming", status }: Props) {
  const t = useT();

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-card active:bg-surface-2",
        variant === "past"
          ? "px-4 py-3"
          : "border border-hairline bg-surface px-4 py-3.5 shadow-card",
        variant === "active" && "border-konvo-200",
      )}
    >
      <div className="min-w-0 flex-1">
        {variant === "active" && (
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-konvo-500">
            {t("home.inProgress")}
          </div>
        )}
        <div
          className={cn(
            "truncate font-bold",
            variant === "active" && "text-[19px] leading-tight",
            variant === "past" && "text-ink-70",
          )}
        >
          {name}
        </div>
        <div
          className={cn(
            "mt-0.5 truncate text-[13px] font-semibold",
            variant === "past" ? "text-ink-35" : "text-ink-50",
          )}
        >
          {detail}
        </div>
      </div>

      {status ? (
        <StatusPill kind={status.kind} size="sm">
          {status.label}
        </StatusPill>
      ) : (
        variant !== "past" && (
          <ChevronRight className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
        )
      )}
    </Link>
  );
}
