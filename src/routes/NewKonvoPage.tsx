import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AvatarPicker } from "@/components/AvatarPicker";
import { TransportPicker } from "@/components/TransportPicker";
import { useT } from "@/i18n";
import { useSession } from "@/session";
import { createTrip, updateMyMemberProfile } from "@/lib/db/trips";
import { searchPlaces, type Place } from "@/lib/services/geocode";
import { fetchRoute } from "@/lib/services/routing";
import type { LatLng, TransportType, TripMode } from "@/lib/konvo/types";

/**
 * Criar um Konvo (brief §09).
 *
 * Tudo numa tela so, de proposito: o brief pede criacao "extremamente rapida" e
 * NAO pede marca, modelo, placa ou foto do carro. Destino, nome, veiculo,
 * comeca. O resto pode existir um dia; nao muda a viagem de setembro.
 */

export function NewKonvoPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { displayName, setDisplayName, phone, setPhone, avatarUrl, setAvatarUrl } =
    useSession();

  const mode = (params.get("mode") as TripMode) ?? "together";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  // Destino pode vir pronto dos sugeridos da Home — nesse caso a tela abre
  // com ele escolhido e a pessoa so confirma.
  const [dest, setDest] = useState<Place | null>(() => {
    const name = params.get("dest");
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { name, context: "", lat, lng };
  });
  const [name, setName] = useState(displayName);
  const [transport, setTransport] = useState<TransportType>("car");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [creating, setCreating] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Origem: usada para calcular a rota. Se a pessoa negar, a viagem e criada
  // mesmo assim — so as distancias ficam menos precisas ate ela comecar a andar.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, []);

  // Debounce de 600 ms: a politica do Nominatim e de 1 requisicao por segundo.
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (dest || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      abort.current?.abort();
      abort.current = new AbortController();
      setSearching(true);
      searchPlaces(query, { signal: abort.current.signal })
        .then(setResults)
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 600);
    return () => clearTimeout(id);
  }, [query, dest]);

  const submit = async () => {
    if (!dest || !name.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const route = origin ? await fetchRoute(origin, dest) : null;
      if (route?.degraded) setWarn(t("new.routeFailed"));

      setDisplayName(name.trim());

      const trip = await createTrip({
        name: dest.name,
        mode,
        destination: { name: dest.name, lat: dest.lat, lng: dest.lng },
        origin,
        displayName: name.trim(),
        transport,
        route,
        startsAt: null,
      });

      await updateMyMemberProfile(trip.id, { phone, avatarUrl }).catch(() => {});
      navigate(`/konvo/${trip.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <h1 className="mb-4 text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
          {t("new.title2")}
        </h1>

        {/* --- destino ------------------------------------------------------ */}
        <div className="flex h-13 items-center gap-3 rounded-card border border-hairline bg-surface px-4 shadow-card" style={{ height: 52 }}>
          <Search className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
          <input
            value={dest ? dest.name : query}
            onChange={(e) => {
              setDest(null);
              setQuery(e.target.value);
            }}
            placeholder={t("home.addDestination")}
            className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-ink-35"
            autoComplete="off"
          />
        </div>

        {searching && <p className="mt-2 text-[13px] font-semibold text-ink-35">{t("new.searching")}</p>}

        {results.length > 0 && !dest && (
          <div className="mt-2 overflow-hidden rounded-card border border-hairline bg-surface">
            {results.map((p, i) => (
              <button
                key={`${p.lat},${p.lng},${i}`}
                type="button"
                onClick={() => {
                  setDest(p);
                  setResults([]);
                }}
                className="flex w-full flex-col items-start border-b border-hairline px-4 py-3 text-left last:border-0 active:bg-surface-2"
              >
                <span className="font-bold">{p.name}</span>
                <span className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-ink-50">
                  {p.context}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* --- quem e voce --------------------------------------------------- */}
        <Label>{t("new.yourName")}</Label>
        <div className="flex items-center gap-3">
          <AvatarPicker
            name={name}
            colorIndex={1}
            value={avatarUrl}
            onChange={setAvatarUrl}
            size="md"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("new.yourName")}
            className="min-w-0 flex-1 rounded-card border border-hairline bg-surface px-4 font-semibold shadow-card outline-none placeholder:text-ink-35"
            style={{ height: 52 }}
          />
        </div>

        {/* Telefone e o plano B: se o app falhar, o grupo ainda liga. */}
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder={t("new.phone")}
          className="mt-2 w-full rounded-card border border-hairline bg-surface px-4 font-semibold shadow-card outline-none placeholder:text-ink-35"
          style={{ height: 52 }}
        />
        <p className="mt-1.5 text-[12.5px] font-semibold text-ink-35">{t("new.phoneCopy")}</p>

        {/* --- veiculo ------------------------------------------------------- */}
        <Label>{t("new.howYouGo")}</Label>
        <TransportPicker value={transport} onChange={setTransport} />

        {origin && (
          <p className="mt-3 text-[13px] font-semibold text-ink-35">{t("new.useMyLocation")}</p>
        )}
        {warn && <p className="mt-3 text-[13px] font-semibold text-stretching-ink">{warn}</p>}
        {error && <p className="mt-3 text-[13px] font-semibold text-split-ink">{error}</p>}
      </div>

      <div className="safe-bottom shrink-0 border-t border-hairline bg-surface px-4 py-3">
        <button
          type="button"
          disabled={!dest || !name.trim() || creating}
          onClick={() => void submit()}
          className="h-14 w-full rounded-pill bg-konvo-500 text-[16px] font-extrabold text-white transition-opacity active:bg-konvo-600 disabled:opacity-35"
        >
          {creating ? t("new.creating") : t("new.create")}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-6 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
      {children}
    </h2>
  );
}
