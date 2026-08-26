import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { en, type TranslationKey } from "./en";
import { ptBR } from "./pt-BR";

export type Locale = "en" | "pt-BR";

const DICTS: Record<Locale, Record<TranslationKey, string>> = {
  en,
  "pt-BR": ptBR,
};

const STORAGE_KEY = "konvo.locale";

export type TFn = (key: TranslationKey, values?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
}

const I18nContext = createContext<I18nValue | null>(null);

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "pt-BR") return saved;
  } catch {
    // Safari privado joga excecao so de tocar no localStorage.
  }
  return navigator.language?.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

/** `{name} está ficando pra trás` + `{ name: "Lucas" }` */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // sem persistencia e aceitavel; trocar de idioma nao pode quebrar o app
    }
  }, []);

  const t = useCallback<TFn>(
    (key, values) => interpolate(DICTS[locale][key] ?? key, values),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n precisa estar dentro de <I18nProvider>");
  return ctx;
}

export function useT(): TFn {
  return useI18n().t;
}
