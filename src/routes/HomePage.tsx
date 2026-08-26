import { useMemo } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { RoutePreview } from "@/components/RoutePreview";
import { StatusPill } from "@/components/StatusPill";
import { demoMembers, demoRoute, demoTrips } from "@/data/demo";
import { useI18n, useT } from "@/i18n";
import { deriveGroupStatus } from "@/lib/konvo/groupStatus";
import { createDeriveContext, deriveMembers } from "@/lib/konvo/memberState";
import { routeFromPolyline } from "@/lib/konvo/route";
import { formatDistance, formatDuration } from "@/lib/konvo/format";
import type { TranslationKey } from "@/i18n/en";

/**
 * Home (brief §07).
 *
 * Quando ha um Konvo em andamento, ele domina a tela — e a unica coisa que
 * importa naquele momento. Sem viagem ativa, o destaque volta para comecar uma.
 */

export function HomePage() {
  const t = useT();
  const { locale } = useI18n();

  const active = demoTrips.find((tr) => tr.status === "active");
  const upcoming = demoTrips.filter((tr) => tr.status === "upcoming");
  const past = demoTrips.filter((tr) => tr.status === "completed");

  // Mesmo no card da Home o status sai da logica real, nao de string fixa.
  const live = useMemo(() => {
    const route = routeFromPolyline(demoRoute.polyline);
    const ctx = createDeriveContext(route, demoRoute.destination, demoRoute.durationS);
    const members = deriveMembers(demoMembers(), ctx);
    return {
      route,
      members,
      status: deriveGroupStatus({ members }),
      lead: members.reduce((a, b) => (a.behindByM <= b.behindByM ? a : b)),
    };
  }, []);

  return (
    <div className="px-4 pb-6 pt-3">
      {/* --- comecar uma viagem ------------------------------------------- */}
      <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
        {t("home.prompt")}
      </h1>

      <button
        type="button"
        className="mt-3 flex h-13 w-full items-center gap-3 rounded-card border border-hairline bg-surface px-4 text-left shadow-card active:bg-surface-2"
        style={{ height: 52 }}
      >
        <Search className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
        <span className="font-semibold text-ink-35">{t("home.addDestination")}</span>
      </button>

      {/* --- Konvo em andamento ------------------------------------------- */}
      {active && (
        <Link
          to={`/konvo/${active.id}`}
          className="mt-5 block overflow-hidden rounded-card border border-hairline bg-surface shadow-card"
        >
          <div className="flex items-start justify-between gap-3 px-4 pt-4">
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-konvo-500">
                {t("home.inProgress")}
              </div>
              <div className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.01em]">
                {active.name}
              </div>
              <div className="mt-0.5 text-[13px] font-semibold text-ink-50">
                {t("count.people", { count: active.peopleCount })} ·{" "}
                {t("count.vehicles", { count: active.vehicleCount ?? 0 })}
              </div>
            </div>
            <StatusPill kind={live.status.kind} size="sm">
              {t(live.status.headlineKey as TranslationKey, live.status.headlineValues)}
            </StatusPill>
          </div>

          <div className="mt-3 bg-surface-2/60">
            <RoutePreview
              route={live.route}
              height={104}
              progressM={live.lead.distanceAlongM ?? 0}
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex -space-x-2.5">
              {live.members.map((m) => (
                <ParticipantAvatar
                  key={m.id}
                  name={m.displayName}
                  colorIndex={m.colorIndex}
                  size="sm"
                  ring
                  short
                  state={m.state}
                />
              ))}
            </div>
            <div className="tnum text-right text-[13px] font-bold text-ink-70">
              {formatDistance(live.lead.remainingM ?? 0, "km", locale)}
              <span className="mx-1.5 text-ink-35">·</span>
              {formatDuration(live.lead.etaS ?? 0, locale)}
            </div>
          </div>

          <div className="flex h-12 items-center justify-center gap-1 border-t border-hairline font-bold text-konvo-500">
            {t("home.openKonvo")}
            <ChevronRight className="size-[18px]" strokeWidth={2.75} />
          </div>
        </Link>
      )}

      {/* --- proximas ------------------------------------------------------ */}
      {upcoming.length > 0 && (
        <Section title={t("home.upcoming")}>
          {upcoming.map((tr) => (
            <Link
              key={tr.id}
              to={`/trips/${tr.id}`}
              className="flex items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3.5 shadow-card active:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{tr.name}</div>
                <div className="mt-0.5 text-[13px] font-semibold text-ink-50">
                  {tr.whenLabel} · {t("count.people", { count: tr.peopleCount })}
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
            </Link>
          ))}
        </Section>
      )}

      {/* --- recentes ------------------------------------------------------ */}
      {past.length > 0 && (
        <Section title={t("home.recent")}>
          {past.map((tr) => (
            <Link
              key={tr.id}
              to={`/trips/${tr.id}`}
              className="flex items-center gap-3 rounded-card px-4 py-3 active:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-ink-70">{tr.name}</div>
                <div className="mt-0.5 text-[13px] font-semibold text-ink-35">
                  {t("count.people", { count: tr.peopleCount })} · {tr.distanceLabel}
                </div>
              </div>
            </Link>
          ))}
        </Section>
      )}
    </div>
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
