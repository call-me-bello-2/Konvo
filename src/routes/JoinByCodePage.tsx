import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useT } from "@/i18n";

/**
 * Entrar digitando o codigo.
 *
 * O caminho normal e o link, que ja leva direto para a tela de entrada. Isto
 * aqui existe para o caso real de quem ouviu o codigo em voz alta dentro do
 * carro — que numa viagem acontece o tempo todo.
 *
 * O campo forca maiusculas e ignora o que nao for do alfabeto do codigo:
 * digitar com pressa, no celular, em movimento, nao pode dar erro de formato.
 */

const ALPHABET = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

export function JoinByCodePage() {
  const t = useT();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const clean = (v: string) => v.toUpperCase().replace(ALPHABET, "").slice(0, 6);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="safe-top shrink-0">
        <div className="flex h-14 items-center px-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t("live.back")}
            className="grid size-10 place-items-center rounded-full active:bg-surface-2"
          >
            <ChevronLeft className="size-6" strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
          {t("join.enterCode")}
        </h1>
        <p className="mt-2 text-[14px] font-semibold text-ink-50">{t("join.codeHint")}</p>

        <input
          value={code}
          onChange={(e) => setCode(clean(e.target.value))}
          placeholder="K7F2QP"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          className="tnum mt-7 w-full rounded-card border-2 border-hairline bg-surface py-5 text-center text-[34px] font-extrabold tracking-[0.18em] outline-none focus:border-konvo-500 placeholder:text-ink-35/40"
        />
      </div>

      <div className="safe-bottom shrink-0 px-4 py-3">
        <button
          type="button"
          disabled={code.length < 6}
          onClick={() => navigate(`/join/${code}`)}
          className="h-14 w-full rounded-pill bg-konvo-500 text-[16px] font-extrabold text-white active:bg-konvo-600 disabled:opacity-35"
        >
          {t("join.go")}
        </button>
      </div>
    </div>
  );
}
