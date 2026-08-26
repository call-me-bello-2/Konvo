import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Tema claro/escuro.
 *
 * Por que isto existe: tela branca dentro de carro escuro na estrada ofusca
 * quem esta dirigindo. Nao e preferencia estetica — e o mesmo motivo pelo qual
 * o painel do carro escurece a noite.
 *
 * Tres modos: `auto` (pelo horario), `light` e `dark`. O padrao e `auto`, e a
 * escolha manual vale ate a pessoa voltar para `auto`.
 */

export type ThemeMode = "auto" | "light" | "dark";
export type Resolved = "light" | "dark";

const STORAGE_KEY = "konvo.theme";

/**
 * Limites do modo automatico.
 *
 * Horario local simples, de proposito: calcular nascer e por do sol de verdade
 * exigiria a posicao da pessoa antes mesmo de ela entrar numa viagem — pedir
 * GPS para escolher cor de fundo seria desproporcional. No Brasil o crepusculo
 * fica entre ~17h30 e ~19h o ano todo; 18h/6h erra por pouco e nao custa nada.
 */
const DARK_FROM_HOUR = 18;
const DARK_UNTIL_HOUR = 6;

export function resolveByClock(date = new Date()): Resolved {
  const h = date.getHours();
  return h >= DARK_FROM_HOUR || h < DARK_UNTIL_HOUR ? "dark" : "light";
}

interface ThemeValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  /** o que esta valendo na tela agora */
  resolved: Resolved;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "auto" || v === "light" || v === "dark") return v;
  } catch {
    // Safari privado joga excecao so de tocar no localStorage
  }
  return "auto";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [clock, setClock] = useState<Resolved>(() => resolveByClock());

  // No modo automatico o tema precisa virar sozinho durante a viagem — sair as
  // 15h e chegar as 20h e exatamente o caso de uso.
  useEffect(() => {
    if (mode !== "auto") return;
    const tick = () => setClock(resolveByClock());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const resolved: Resolved = mode === "auto" ? clock : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    // A barra de status do sistema tambem precisa acompanhar, senao fica uma
    // faixa clara no topo da tela no escuro.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "dark" ? "#0B0E14" : "#0043FD");
  }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // sem persistencia e aceitavel; trocar tema nao pode quebrar o app
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode, resolved }), [mode, setMode, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return ctx;
}
