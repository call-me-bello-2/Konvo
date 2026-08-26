import { ChevronRight, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { ChevronMotif } from "@/components/ChevronMotif";
import { TripCard } from "@/components/TripCard";
import { useMyTrips, type TripSummary } from "@/hooks/useMyTrips";
import { useI18n, useT } from "@/i18n";
import { formatDistance } from "@/lib/konvo/format";

/**
 * Home (brief §07).
 *
 * Quando ha um Konvo em andamento, ele domina a tela — e a unica coisa que
 * importa naquele momento. Sem viagem nenhuma, a tela inteira vira o convite
 * para comecar uma, em vez de uma lista vazia com cara de erro.
 */

export function HomePage() {
  const t = useT();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { active, upcoming, past, loading, error } = useMyTrips();

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <ChevronMotif className="opacity-40" />
      </div>
    );
  }

  const hasAny = active.length + upcoming.length + past.length > 0;

  // --- primeiro uso ---------------------------------------------------------
  if (!hasAny) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div className="w-full max-w-xs">
          <ChevronMotif className="mx-auto mb-6" />
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
            {t("empty.home.tagline")}
          </h1>
          <p className="mt-2 text-[15px] font-semibold leading-snug text-ink-50">
            {t("empty.home.copy")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/new?mode=together")}
            className="mt-7 h-14 w-full rounded-pill bg-konvo-500 text-[16px] font-extrabold text-white active:bg-konvo-600"
          >
            {t("empty.home.cta")}
          </button>
          {error && (
            <p className="mt-4 text-[12px] font-semibold text-split-ink">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-3">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
        {t("home.prompt")}
      </h1>

      <button
        type="button"
        onClick={() => navigate("/new?mode=together")}
        className="mt-3 flex w-full items-center gap-3 rounded-card border border-hairline bg-surface px-4 text-left shadow-card active:bg-surface-2"
        style={{ height: 52 }}
      >
        <Search className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
        <span className="font-semibold text-ink-35">{t("home.addDestination")}</span>
      </button>

      {active.length > 0 && (
        <div className="mt-5 flex flex-col gap-2">
          {active.map((s) => (
            <ActiveCard key={s.trip.id} summary={s} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <Section title={t("home.upcoming")}>
          {upcoming.map((s) => (
            <TripCard
              key={s.trip.id}
              to={`/trips/${s.trip.id}`}
              name={s.trip.name}
              detail={t("count.people", { count: s.peopleCount })}
            />
          ))}
        </Section>
      )}

      {past.length > 0 && (
        <Section title={t("home.recent")}>
          {past.map((s) => (
            <TripCard
              key={s.trip.id}
              to={`/trips/${s.trip.id}`}
              name={s.trip.name}
              detail={`${t("count.people", { count: s.peopleCount })}${
                s.trip.routeDistanceM
                  ? ` · ${formatDistance(s.trip.routeDistanceM, "km", locale)}`
                  : ""
              }`}
              variant="past"
            />
          ))}
        </Section>
      )}
    </div>
  );
}

/**
 * O Konvo em andamento.
 *
 * Nao mostra estado do grupo nem ETA aqui de proposito: isso exigiria abrir a
 * conexao ao vivo da viagem so para desenhar um card. O estado de verdade esta
 * a um toque, na tela do Live.
 */
function ActiveCard({ summary }: { summary: TripSummary }) {
  const t = useT();
  const { trip, peopleCount, vehicleCount } = summary;

  return (
    <Link
      to={`/konvo/${trip.id}`}
      className="block overflow-hidden rounded-card border border-konvo-200 bg-surface shadow-card"
    >
      <div className="px-4 pb-4 pt-4">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-konvo-500">
          {t("home.inProgress")}
        </div>
        <div className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.01em]">
          {trip.name}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-ink-50">
          {t("count.people", { count: peopleCount })} ·{" "}
          {t("count.vehicles", { count: vehicleCount })}
        </div>
      </div>

      <div className="flex h-12 items-center justify-center gap-1 border-t border-hairline font-bold text-konvo-500">
        {t("home.openKonvo")}
        <ChevronRight className="size-[18px]" strokeWidth={2.75} />
      </div>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
