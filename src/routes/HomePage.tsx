import { ChevronRight, MapPin, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { ChevronMotif } from "@/components/ChevronMotif";
import { DestinationSearch } from "@/components/DestinationSearch";
import { RoutePreview } from "@/components/RoutePreview";
import { useMyTrips, type TripSummary } from "@/hooks/useMyTrips";
import { useI18n, useT } from "@/i18n";
import { POPULAR, type PopularDestination } from "@/data/popular";
import { formatDistance, formatDuration } from "@/lib/konvo/format";
import { routeFromPolyline, straightLineRoute } from "@/lib/konvo/route";

/**
 * Home (brief §07).
 *
 * A ordem da tela responde as perguntas na sequencia em que elas aparecem:
 *   1. para onde vamos?      — criar, que e o que 90% das aberturas quer
 *   2. e se me convidaram?   — entrar, discreto mas sempre visivel
 *   3. como vamos?           — os dois modos do produto (§08)
 *   4. e a viagem de agora?  — o Konvo em andamento, quando existe
 *   5. e as proximas?
 *
 * O Konvo ativo nao fica no topo de proposito: quem ja esta viajando abre o
 * app pelo mapa, nao por aqui.
 */

export function HomePage() {
  const t = useT();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { active, upcoming, loading } = useMyTrips();

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <ChevronMotif className="opacity-40" />
      </div>
    );
  }

  const startWith = (d: PopularDestination) =>
    navigate(
      `/new?mode=together&dest=${encodeURIComponent(d.name)}&lat=${d.lat}&lng=${d.lng}`,
    );

  return (
    <div className="px-4 pb-8">
      {/* --- 1. para onde vamos ------------------------------------------- */}
      <h1 className="pt-2 text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em]">
        {t("home.headingA")}
        <span className="text-konvo-500">{t("home.headingB")}</span>
      </h1>

      {/* A busca acontece aqui mesmo; a troca de tela vira consequencia de
          escolher um destino, e nao pre-requisito para procurar um. */}
      <DestinationSearch
        className="mt-5"
        onPick={(p) =>
          navigate(
            `/new?mode=together&dest=${encodeURIComponent(p.name)}&lat=${p.lat}&lng=${p.lng}`,
          )
        }
      />

      {/* --- 2. recebi um convite ----------------------------------------- */}
      <div className="mt-3.5 flex items-center gap-2 text-[14px]">
        <span className="font-semibold text-ink-50">{t("home.haveInvite")}</span>
        <Link to="/join" className="flex items-center gap-0.5 font-bold text-konvo-500">
          {t("home.joinKonvo")}
          <ChevronRight className="size-4" strokeWidth={2.75} />
        </Link>
      </div>

      {/* --- 3. os dois modos (§08) ---------------------------------------- */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <ModeCard
          tone="konvo"
          title={t("new.together")}
          copy={t("new.togetherCopy")}
          onClick={() => navigate("/new?mode=together")}
        />
        <ModeCard
          tone="together"
          title={t("new.meet")}
          copy={t("new.meetCopy")}
          onClick={() => navigate("/new?mode=meet")}
        />
      </div>

      {/* --- 4. o Konvo de agora ------------------------------------------- */}
      {active.length > 0 && (
        <>
          <SectionHead
            title={t("home.activeKonvo")}
            dot
            action={{ label: t("home.viewLive"), to: `/konvo/${active[0].trip.id}` }}
          />
          <div className="flex flex-col gap-2">
            {active.map((s) => (
              <ActiveCard key={s.trip.id} summary={s} locale={locale} />
            ))}
          </div>
        </>
      )}

      {/* --- 5. as proximas ------------------------------------------------ */}
      {upcoming.length > 0 && (
        <>
          <SectionHead title={t("home.upcoming")} action={{ label: t("home.seeAll"), to: "/trips" }} />
          <div className="flex flex-col gap-2">
            {upcoming.map((s) => (
              <Link
                key={s.trip.id}
                to={`/trips/${s.trip.id}`}
                className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-3 shadow-card active:bg-surface-2"
              >
                <div
                  className="grid size-14 shrink-0 place-items-center rounded-[12px] text-white"
                  style={{ background: "linear-gradient(135deg,#0043fd,#7b61ff)" }}
                >
                  <MapPin className="size-6" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-extrabold leading-tight">
                    {s.trip.name}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-50">
                    <Users className="size-[14px]" strokeWidth={2.5} />
                    {t("count.people", { count: s.peopleCount })}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* --- destinos sugeridos -------------------------------------------- */}
      <SectionHead title={t("home.popular")} />
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {POPULAR.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => startWith(d)}
            className="w-[132px] shrink-0 overflow-hidden rounded-card border border-hairline bg-surface text-left shadow-card active:opacity-80"
          >
            <div className="h-[76px] w-full" style={{ background: d.tint }} />
            <div className="px-3 py-2.5">
              <div className="truncate text-[14px] font-extrabold leading-tight">{d.name}</div>
              <div className="mt-0.5 truncate text-[12px] font-semibold text-ink-35">
                {d.context}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ModeCard({
  title,
  copy,
  onClick,
  tone,
}: {
  title: string;
  copy: string;
  onClick: () => void;
  tone: "konvo" | "together";
}) {
  const isKonvo = tone === "konvo";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-col rounded-card border p-3.5 text-left active:opacity-80 " +
        (isKonvo ? "border-konvo-100 bg-konvo-50" : "border-hairline bg-together-soft")
      }
    >
      <span
        className={
          "grid size-10 place-items-center rounded-full bg-surface " +
          (isKonvo ? "text-konvo-500" : "text-together-ink")
        }
      >
        {isKonvo ? (
          <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11M4 11h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm2.5 5v1.5m11-1.5v1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <MapPin className="size-[21px]" strokeWidth={2.25} />
        )}
      </span>
      <span className="mt-2.5 text-[15px] font-extrabold leading-tight">{title}</span>
      <span className="mt-1 text-[12.5px] font-semibold leading-snug text-ink-50">{copy}</span>
    </button>
  );
}

/**
 * O Konvo em andamento.
 *
 * Mostra a silhueta da rota, nao um mapa com tiles: em 90 px de altura ninguem
 * le nome de rua, e carregar o mapa aqui custaria bateria e dados numa tela
 * que a pessoa so passa o olho. O mapa de verdade esta a um toque.
 */
function ActiveCard({ summary, locale }: { summary: TripSummary; locale: string }) {
  const t = useT();
  const { trip, peopleCount, vehicleCount } = summary;

  const route = trip.routePolyline
    ? routeFromPolyline(trip.routePolyline)
    : trip.origin
      ? straightLineRoute(trip.origin, trip.destination)
      : null;

  return (
    <Link
      to={`/konvo/${trip.id}`}
      className="block overflow-hidden rounded-card border border-hairline bg-surface shadow-card"
    >
      <div className="flex gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] font-extrabold leading-tight tracking-[-0.01em]">
            {trip.name}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-together-ink">
            <span className="size-2 rounded-full bg-together" />
            {t("count.people", { count: peopleCount })} ·{" "}
            {t("count.vehicles", { count: vehicleCount })}
          </div>
        </div>

        {route && (
          <div className="w-[104px] shrink-0 rounded-[10px] bg-surface-2/60 py-1">
            <RoutePreview route={route} height={54} aspect={1.9} />
          </div>
        )}
      </div>

      <div className="flex items-stretch gap-3 border-t border-hairline px-4 py-3">
        {trip.routeDistanceM != null && (
          <Stat label={t("home.remaining")} value={formatDistance(trip.routeDistanceM, "km", locale)} />
        )}
        {trip.routeDurationS != null && (
          <Stat label={t("home.eta")} value={formatDuration(trip.routeDurationS, locale)} />
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1 self-center rounded-pill bg-konvo-500 px-4 py-2.5 text-[14px] font-extrabold text-white">
          {t("home.openKonvo")}
          <ChevronRight className="size-[17px]" strokeWidth={2.75} />
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="tnum truncate text-[15px] font-extrabold leading-tight">{value}</div>
      <div className="truncate text-[11px] font-bold uppercase tracking-[0.05em] text-ink-35">
        {label}
      </div>
    </div>
  );
}

function SectionHead({
  title,
  action,
  dot,
}: {
  title: string;
  action?: { label: string; to: string };
  dot?: boolean;
}) {
  return (
    <div className="mb-2 mt-7 flex items-center gap-2">
      <h2 className="text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
        {title}
      </h2>
      {dot && <span className="size-2 rounded-full bg-together" />}
      {action && (
        <Link
          to={action.to}
          className="ml-auto flex items-center gap-0.5 text-[13px] font-bold text-konvo-500"
        >
          {action.label}
          <ChevronRight className="size-4" strokeWidth={2.75} />
        </Link>
      )}
    </div>
  );
}
