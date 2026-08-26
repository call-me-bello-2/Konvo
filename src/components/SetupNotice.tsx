import { AlertTriangle } from "lucide-react";

import { useT } from "@/i18n";
import { useSession } from "@/session";

/**
 * Aviso de configuracao pendente.
 *
 * Sem banco, o app quebraria em silencio — telas vazias, botoes que nao fazem
 * nada, nenhuma pista do motivo. Melhor dizer exatamente o que falta.
 *
 * Some sozinho quando a sessao funciona; nao e uma tela do produto.
 */

export function SetupNotice() {
  const { error, loading, retry } = useSession();
  const t = useT();

  if (loading || !error) return null;

  return (
    <div className="shrink-0 border-b border-hairline bg-stretching-soft px-4 py-3">
      <div className="flex gap-2.5">
        <AlertTriangle
          className="mt-0.5 size-[18px] shrink-0 text-stretching-ink"
          strokeWidth={2.5}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-stretching-ink">
            {t("setup.needsDb")}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold leading-snug text-stretching-ink/80">
            {t("setup.needsDbCopy")}
          </p>
          <p className="mt-1.5 break-words font-mono text-[11px] leading-snug text-stretching-ink/60">
            {error}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 text-[13px] font-bold text-stretching-ink underline"
          >
            {t("setup.retry")}
          </button>
        </div>
      </div>
    </div>
  );
}
