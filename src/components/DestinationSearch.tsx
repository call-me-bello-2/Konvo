import { useEffect, useRef, useState } from "react";
import { ArrowRight, MapPin, Search, X } from "lucide-react";

import { useT } from "@/i18n";
import { searchPlaces, type Place } from "@/lib/services/geocode";
import { cn } from "@/lib/utils";

/**
 * Busca de destino, resolvida na propria tela.
 *
 * Antes, tocar no campo levava para outra pagina so para digitar — a pessoa
 * perdia o contexto antes de ter feito qualquer coisa. Agora o campo cresce
 * onde esta, os resultados aparecem logo abaixo, e so depois de ESCOLHER o
 * destino e que a tela muda. A troca de pagina passa a ser consequencia de uma
 * decisao, e nao pre-requisito para tomar uma.
 */

interface Props {
  onPick: (place: Place) => void;
  /** cor de fundo do campo quando fechado */
  className?: string;
}

export function DestinationSearch({ onPick, className }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Debounce de 600 ms: a politica do Nominatim e de 1 requisicao por segundo.
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      abort.current?.abort();
      abort.current = new AbortController();
      searchPlaces(query, { signal: abort.current.signal })
        .then(setResults)
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 600);
    return () => clearTimeout(id);
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    abort.current?.abort();
  };

  return (
    <div className={className}>
      <div
        className={cn(
          "flex items-center gap-3 border bg-surface shadow-card transition-all duration-200",
          open
            ? "rounded-card border-konvo-500 py-2 pl-4 pr-2"
            : "rounded-pill border-hairline py-2 pl-5 pr-2",
        )}
      >
        <Search className="size-[19px] shrink-0 text-ink-35" strokeWidth={2.5} />

        <input
          ref={input}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("home.addDestination")}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] font-semibold outline-none placeholder:text-ink-35"
        />

        {open ? (
          <button
            type="button"
            onClick={close}
            aria-label={t("live.cancel")}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-35 active:bg-surface-2"
          >
            <X className="size-5" strokeWidth={2.5} />
          </button>
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-konvo-500 text-white">
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </span>
        )}
      </div>

      {open && (
        <div className="animate-rise mt-2 overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
          {query.trim().length < 3 ? (
            <p className="px-4 py-4 text-[13px] font-semibold text-ink-35">
              {t("home.typeToSearch")}
            </p>
          ) : searching && results.length === 0 ? (
            <p className="px-4 py-4 text-[13px] font-semibold text-ink-35">
              {t("new.searching")}
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-4 text-[13px] font-semibold text-ink-35">
              {t("new.noResults")}
            </p>
          ) : (
            results.map((p, i) => (
              <button
                key={`${p.lat},${p.lng},${i}`}
                type="button"
                onClick={() => {
                  close();
                  onPick(p);
                }}
                className="flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-left last:border-0 active:bg-surface-2"
              >
                <MapPin className="size-[18px] shrink-0 text-konvo-500" strokeWidth={2.25} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink-50">
                    {p.context}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
