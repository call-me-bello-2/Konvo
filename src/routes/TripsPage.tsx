import { useNavigate } from "react-router-dom";

import { ChevronMotif } from "@/components/ChevronMotif";
import { POPULAR } from "@/data/popular";
import { TripCard } from "@/components/TripCard";
import { useMyTrips } from "@/hooks/useMyTrips";
import { useI18n, useT } from "@/i18n";
import { formatDistance } from "@/lib/konvo/format";

/**
 * Trips (brief §19).
 *
 * A lista e deliberadamente rasa: quem chega aqui so quer escolher qual viagem
 * abrir. O peso do design fica na tela da viagem, nao na lista.
 */

export function TripsPage() {
  const t = useT();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { active, upcoming, past, loading } = useMyTrips();

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <ChevronMotif className="opacity-40" />
      </div>
    );
  }

  // Lista vazia nao ajuda ninguem: em vez de anunciar o vazio, a tela oferece
  // um comeco. Tocar num destino cria a viagem de verdade, com rota calculada.
  if (active.length + upcoming.length + past.length === 0) {
    return (
      <div className="px-4 pb-8 pt-10">
        <div className="text-center">
          <ChevronMotif className="mx-auto mb-5" />
          <h2 className="text-[20px] font-extrabold">{t("empty.trips.title")}</h2>
          <p className="mt-1.5 text-[14px] font-semibold text-ink-50">
            {t("empty.trips.copy")}
          </p>
        </div>

        <h3 className="mb-2 mt-8 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
          {t("trips.emptyIdea")}
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {POPULAR.map((d) => (
            <button
              key={d.name}
              type="button"
              onClick={() =>
                navigate(
                  `/new?mode=together&dest=${encodeURIComponent(d.name)}&lat=${d.lat}&lng=${d.lng}`,
                )
              }
              className="overflow-hidden rounded-card border border-hairline bg-surface text-left shadow-card active:opacity-80"
            >
              <div className="relative h-[84px] w-full" style={{ background: d.tint }}>
                <img
                  src={d.photo}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
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

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="mb-4 text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
        {t("trips.title")}
      </h1>

      {active.length > 0 && (
        <Section title={t("trips.active")}>
          {active.map((s) => (
            <TripCard
              key={s.trip.id}
              to={`/konvo/${s.trip.id}`}
              name={s.trip.name}
              detail={`${t("count.people", { count: s.peopleCount })} · ${t("count.vehicles", {
                count: s.vehicleCount,
              })}`}
              variant="active"
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title={t("trips.upcoming")}>
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
        <Section title={t("trips.past")}>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
