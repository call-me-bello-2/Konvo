import { useMemo } from "react";

import { TripCard } from "@/components/TripCard";
import { demoMembers, demoRoute, demoTrips } from "@/data/demo";
import { useT } from "@/i18n";
import { deriveGroupStatus } from "@/lib/konvo/groupStatus";
import { createDeriveContext, deriveMembers } from "@/lib/konvo/memberState";
import { routeFromPolyline } from "@/lib/konvo/route";
import { deriveVehicles } from "@/lib/konvo/vehicles";
import type { TranslationKey } from "@/i18n/en";

/**
 * Trips (brief §19).
 *
 * A lista e deliberadamente rasa: o peso do design esta em `TripDetail`, que e
 * onde se mexe na viagem antes de sair. Aqui a pessoa so escolhe qual.
 */

export function TripsPage() {
  const t = useT();

  const active = demoTrips.filter((tr) => tr.status === "active");
  const upcoming = demoTrips.filter((tr) => tr.status === "upcoming");
  const past = demoTrips.filter((tr) => tr.status === "completed");

  // O status da viagem ativa sai da logica real, sobre veiculos.
  const liveStatus = useMemo(() => {
    const route = routeFromPolyline(demoRoute.polyline);
    const ctx = createDeriveContext(route, demoRoute.destination, demoRoute.durationS);
    const vehicles = deriveVehicles(deriveMembers(demoMembers(), ctx));
    return deriveGroupStatus({ members: vehicles });
  }, []);

  const isEmpty = demoTrips.length === 0;

  if (isEmpty) {
    return (
      <div className="grid h-full place-items-center px-10 text-center">
        <div>
          {/* Geometria da marca, nao ilustracao de banco de imagem (§33). */}
          <ChevronMotif className="mx-auto mb-5" />
          <h2 className="text-[20px] font-extrabold">{t("empty.trips.title")}</h2>
          <p className="mt-1.5 text-[14px] font-semibold text-ink-50">
            {t("empty.trips.copy")}
          </p>
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
          {active.map((tr) => (
            <TripCard
              key={tr.id}
              to={`/konvo/${tr.id}`}
              name={tr.name}
              detail={`${t("count.people", { count: tr.peopleCount })} · ${t("count.vehicles", {
                count: tr.vehicleCount ?? 0,
              })}`}
              variant="active"
              status={{
                kind: liveStatus.kind,
                label: t(liveStatus.headlineKey as TranslationKey, liveStatus.headlineValues),
              }}
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title={t("trips.upcoming")}>
          {upcoming.map((tr) => (
            <TripCard
              key={tr.id}
              to={`/trips/${tr.id}`}
              name={tr.name}
              detail={`${tr.whenLabel} · ${t("count.people", { count: tr.peopleCount })}`}
            />
          ))}
        </Section>
      )}

      {past.length > 0 && (
        <Section title={t("trips.past")}>
          {past.map((tr) => (
            <TripCard
              key={tr.id}
              to={`/trips/${tr.id}`}
              name={tr.name}
              detail={`${t("count.people", { count: tr.peopleCount })} · ${tr.distanceLabel}`}
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

/**
 * O chevron da marca repetido (brief §34): `<` `<<` `<<<` comunica seguir,
 * mover, progredir. Usado nos vazios e nas transicoes.
 */
export function ChevronMotif({ className }: { className?: string }) {
  return (
    <svg
      width="72"
      height="34"
      viewBox="0 0 72 34"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${10 + i * 22} 6 L${25 + i * 22} 17 L${10 + i * 22} 28`}
          stroke="var(--color-konvo-500)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.25 + i * 0.32}
        />
      ))}
    </svg>
  );
}
