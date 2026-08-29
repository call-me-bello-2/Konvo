import { useEffect, useState } from "react";
import { ChevronLeft, Flag, MapPin, Play, Trash2, UserPlus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { ChevronMotif } from "@/components/ChevronMotif";
import { DestinationSearch } from "@/components/DestinationSearch";
import { InviteSheet } from "@/components/InviteSheet";
import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { useCheckpoints } from "@/hooks/useCheckpoints";
import { useI18n, useT } from "@/i18n";
import { getMembers, getTrip, startTrip } from "@/lib/db/trips";
import { routeFromPolyline, straightLineRoute } from "@/lib/konvo/route";
import { formatDistance, formatDuration } from "@/lib/konvo/format";
import { isRoadBound, type Trip, type TripMember } from "@/lib/konvo/types";

/**
 * A viagem antes de comecar.
 *
 * E aqui que a familia mexe nos dias anteriores: quem vai em qual carro, onde
 * o grupo se encontra, onde vai parar no caminho. O Live Konvo e para a
 * estrada; esta tela e para o combinado.
 */

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addingStop, setAddingStop] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    void Promise.all([getTrip(tripId), getMembers(tripId)])
      .then(([tr, m]) => {
        setTrip(tr);
        setMembers(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripId]);

  const route = trip?.routePolyline
    ? routeFromPolyline(trip.routePolyline)
    : trip?.origin
      ? straightLineRoute(trip.origin, trip.destination)
      : null;

  const { checkpoints, add, remove } = useCheckpoints(tripId, route, null, []);

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <ChevronMotif className="opacity-40" />
      </div>
    );
  }
  if (!trip) {
    return (
      <div className="grid h-full place-items-center px-10 text-center">
        <p className="text-[15px] font-semibold text-ink-50">{t("detail.notFound")}</p>
      </div>
    );
  }

  // Veiculos sao quem nao esta de carona; passageiros aparecem sob o motorista.
  const drivers = members.filter((m) => m.ridingWith === null);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="safe-top shrink-0">
        <div className="flex h-14 items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t("live.back")}
            className="grid size-10 place-items-center rounded-full active:bg-surface-2"
          >
            <ChevronLeft className="size-6" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            aria-label={t("invite.title")}
            className="ml-auto grid size-10 place-items-center rounded-full active:bg-surface-2"
          >
            <UserPlus className="size-[21px]" strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
          {trip.name}
        </h1>
        <p className="mt-1.5 text-[14px] font-semibold text-ink-50">
          {trip.routeDistanceM != null && formatDistance(trip.routeDistanceM, "km", locale)}
          {trip.routeDistanceM != null && trip.routeDurationS != null && " · "}
          {trip.routeDurationS != null && formatDuration(trip.routeDurationS, locale)}
        </p>

        {/* --- onde o grupo se junta ---------------------------------------- */}
        {trip.meeting && (
          <div className="mt-5 rounded-card border border-konvo-200 bg-konvo-50 p-4">
            <div className="flex gap-2.5">
              <MapPin className="mt-0.5 size-[17px] shrink-0 text-konvo-500" strokeWidth={2.5} />
              <div className="min-w-0">
                <div className="text-[14px] font-bold leading-snug">
                  {t("join.meetAt")} {trip.meeting.name}
                </div>
                {trip.meetAt && (
                  <div className="tnum mt-0.5 text-[13px] font-semibold text-ink-50">
                    {new Date(trip.meetAt).toLocaleString(locale, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- os carros ----------------------------------------------------- */}
        <Section title={t("detail.cars")}>
          {drivers.map((d) => {
            const riders = members.filter((m) => m.ridingWith === d.id);
            return (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3 shadow-card"
              >
                <ParticipantAvatar
                  name={d.displayName}
                  colorIndex={d.colorIndex}
                  avatarUrl={d.avatarUrl}
                  size="md"
                  short
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{d.displayName}</div>
                  <div className="mt-0.5 truncate text-[13px] font-semibold text-ink-50">
                    {riders.length > 0
                      ? riders.map((r) => r.displayName).join(", ")
                      : t(isRoadBound(d.transport) ? "member.onRoute" : "transport.other")}
                  </div>
                </div>
              </div>
            );
          })}
        </Section>

        {/* --- paradas do caminho -------------------------------------------- */}
        <Section title={t("detail.stops")}>
          {checkpoints.map((cp) => (
            <div
              key={cp.id}
              className="flex items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3 shadow-card"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-konvo-50 text-konvo-500">
                <Flag className="size-[17px]" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{cp.name}</div>
                {cp.atDistanceM != null && (
                  <div className="tnum mt-0.5 text-[13px] font-semibold text-ink-50">
                    {formatDistance(cp.atDistanceM, "km", locale)}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void remove(cp.id)}
                aria-label={t("live.cancel")}
                className="grid size-9 shrink-0 place-items-center rounded-full text-ink-35 active:bg-surface-2"
              >
                <Trash2 className="size-[17px]" strokeWidth={2.25} />
              </button>
            </div>
          ))}

          {addingStop ? (
            <DestinationSearch
              placeholder={t("detail.searchStop")}
              onPick={async (p) => {
                setAddingStop(false);
                await add({ name: p.name, lat: p.lat, lng: p.lng }).catch(() => {});
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingStop(true)}
              className="flex items-center justify-center gap-2 rounded-card border border-dashed border-hairline py-3.5 font-bold text-ink-50 active:bg-surface-2"
            >
              <MapPin className="size-[17px]" strokeWidth={2.5} />
              {t("checkpoint.add")}
            </button>
          )}

          <p className="text-[12.5px] font-semibold leading-snug text-ink-35">
            {t("detail.stopsCopy")}
          </p>
        </Section>
      </div>

      {trip.status !== "active" && (
        <div className="safe-bottom shrink-0 border-t border-hairline bg-surface px-4 py-3">
          <button
            type="button"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              await startTrip(trip.id).catch(() => {});
              navigate(`/konvo/${trip.id}`, { replace: true });
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-konvo-500 text-[16px] font-extrabold text-white active:bg-konvo-600 disabled:opacity-40"
          >
            <Play className="size-[19px]" strokeWidth={2.75} />
            {t("detail.start")}
          </button>
        </div>
      )}

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        tripName={trip.name}
        code={trip.code}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
