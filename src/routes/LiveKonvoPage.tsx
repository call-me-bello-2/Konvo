import { useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Fuel,
  MapPin,
  Navigation,
  UserPlus,
  Toilet,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { BottomSheet } from "@/components/BottomSheet";
import { InviteSheet } from "@/components/InviteSheet";
import { KonvoMap } from "@/components/KonvoMap";
import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { StatusPill } from "@/components/StatusPill";
import { TalkButton } from "@/components/TalkButton";
import { useLiveTrip } from "@/hooks/useLiveTrip";
import { useI18n, useT } from "@/i18n";
import { logEvent, markArrived, sendQuickAction } from "@/lib/db/live";
import { navigationUrl } from "@/lib/services/routing";
import { formatAgo, formatDistance, formatDuration, formatDurationShort } from "@/lib/konvo/format";
import { cn } from "@/lib/utils";
import type { QuickActionKind, Vehicle } from "@/lib/konvo/types";
import type { TranslationKey } from "@/i18n/en";

/**
 * Live Konvo — a tela mais importante do produto (brief §11).
 *
 * Desenhada para ser lida de relance por quem esta dirigindo: o estado do grupo
 * em uma frase no topo, o mapa no meio, e uma folha embaixo com o que precisa
 * de acao. Nenhum calculo acontece aqui — tudo vem derivado de `useLiveTrip`.
 */

export function LiveKonvoPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();

  const live = useLiveTrip(tripId);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmEmergency, setConfirmEmergency] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { trip, me, vehicles, status } = live;

  if (live.loading) {
    return <FullMessage>…</FullMessage>;
  }
  if (live.error || !trip) {
    return <FullMessage>{live.error ?? t("join.notFound")}</FullMessage>;
  }

  const others = Math.max(0, vehicles.length - 1);
  const lead = vehicles.reduce<Vehicle | null>(
    (a, b) => (a === null || b.behindByM < a.behindByM ? b : a),
    null,
  );

  const quick = async (kind: QuickActionKind) => {
    if (!me || !tripId) return;
    setActionsOpen(false);
    await sendQuickAction(tripId, me.id, kind, me.displayName).catch(() => {});
  };

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* --- cabecalho ------------------------------------------------------ */}
      <header className="safe-top z-20 shrink-0 border-b border-hairline bg-canvas">
        <div className="flex h-14 items-center gap-2 px-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label={t("live.back")}
            className="grid size-10 shrink-0 place-items-center rounded-full active:bg-surface-2"
          >
            <ChevronLeft className="size-6" strokeWidth={2.5} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-extrabold leading-tight">{trip.name}</div>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            aria-label={t("invite.title")}
            className="grid size-10 shrink-0 place-items-center rounded-full active:bg-surface-2"
          >
            <UserPlus className="size-[21px]" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="mr-1 flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-surface-2 px-3 text-[13px] font-bold"
          >
            <Navigation className="size-4" strokeWidth={2.5} />
            {t("live.navigate")}
          </button>
        </div>

        {/* Estado do grupo logo abaixo do titulo: e a informacao que a pessoa
            veio buscar, e tem que estar antes do mapa. */}
        {status && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <StatusPill kind={status.kind} trailing={`${vehicles.length}`}>
              {t(status.headlineKey as TranslationKey, {
                ...status.headlineValues,
                time: status.headlineValues.seconds
                  ? formatDurationShort(Number(status.headlineValues.seconds))
                  : "",
              })}
            </StatusPill>
          </div>
        )}
      </header>

      {/* --- avisos honestos ------------------------------------------------ */}
      <Banners live={live} t={t} />

      {/* --- mapa ------------------------------------------------------------ */}
      <div className="relative min-h-0 flex-1">
        <KonvoMap
          route={live.route}
          vehicles={vehicles}
          destination={trip.destination}
          className="absolute inset-0"
        />
      </div>

      {/* --- folha inferior -------------------------------------------------- */}
      <div className="safe-bottom z-20 shrink-0 border-t border-hairline bg-surface px-4 pb-3 pt-3">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div className="text-[13px] font-bold text-ink-70">
            {t("count.people", { count: live.members.length })} ·{" "}
            {t("count.vehicles", { count: vehicles.length })}
          </div>
          {lead?.remainingM != null && lead.etaS != null && (
            <div className="tnum text-[13px] font-bold text-ink-70">
              {formatDistance(lead.remainingM, "km", locale)}
              <span className="mx-1.5 text-ink-35">·</span>
              {formatDuration(lead.etaS, locale)}
            </div>
          )}
        </div>

        <div className="mb-3 flex gap-2">
          {me && tripId && (
            <TalkButton
              tripId={tripId}
              memberId={me.id}
              listenerCount={others}
              idleLabel={t("live.holdToTalk")}
              label={(n) => t("live.talkingTo", { count: n })}
            />
          )}
          <button
            type="button"
            onClick={() => setActionsOpen(true)}
            aria-label={t("live.quickActions")}
            className="grid size-14 shrink-0 place-items-center rounded-pill bg-surface-2 text-ink-70 active:bg-surface-3"
          >
            <Users className="size-6" strokeWidth={2.25} />
          </button>
        </div>

        <GroupList vehicles={vehicles} t={t} locale={locale} />
      </div>

      {/* --- acoes rapidas (brief §15) --------------------------------------- */}
      <BottomSheet
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        title={t("live.quickActions")}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <QuickButton icon={Fuel} label={t("quick.gas")} onClick={() => void quick("gas")} />
          <QuickButton icon={Toilet} label={t("quick.bathroom")} onClick={() => void quick("bathroom")} />
          <QuickButton icon={UtensilsCrossed} label={t("quick.food")} onClick={() => void quick("food")} />
          <QuickButton icon={MapPin} label={t("quick.stop")} onClick={() => void quick("stop")} />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void quick("ok")}
            className="h-12 rounded-card bg-together-soft font-bold text-together-ink active:opacity-80"
          >
            {t("quick.ok")}
          </button>

          {/* Emergencia separada e vermelha, e com confirmacao: toque acidental
              nao pode alarmar a familia inteira na estrada. */}
          <button
            type="button"
            onClick={() => setConfirmEmergency(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-card bg-split-soft font-bold text-split-ink active:opacity-80"
          >
            <AlertTriangle className="size-[18px]" strokeWidth={2.5} />
            {t("live.emergency")}
          </button>
        </div>

        <button
          type="button"
          onClick={async () => {
            if (!me) return;
            setActionsOpen(false);
            await markArrived(me.id).catch(() => {});
          }}
          className="mt-4 w-full py-2 text-[14px] font-bold text-ink-50"
        >
          {t("live.arrived")}
        </button>
      </BottomSheet>

      {/* --- confirmacao de emergencia --------------------------------------- */}
      <BottomSheet
        open={confirmEmergency}
        onOpenChange={setConfirmEmergency}
        title={t("live.emergency")}
        description={t("live.emergencyCopy")}
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={async () => {
              setConfirmEmergency(false);
              if (!me || !tripId) return;
              await logEvent(tripId, me.id, "quick_action", {
                kind: "problem",
                name: me.displayName,
                lat: live.myFix?.lat,
                lng: live.myFix?.lng,
              }).catch(() => {});
              navigator.vibrate?.([100, 60, 100]);
            }}
            className="h-13 rounded-card bg-split py-3.5 font-extrabold text-white active:opacity-90"
          >
            {t("live.confirm")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmEmergency(false)}
            className="py-3 font-bold text-ink-50"
          >
            {t("live.cancel")}
          </button>
        </div>
      </BottomSheet>

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        tripName={trip.name}
        code={trip.code}
      />

      {/* --- navegar (brief §17) --------------------------------------------- */}
      <BottomSheet open={navOpen} onOpenChange={setNavOpen} title={t("live.openWith")}>
        <div className="flex flex-col gap-2">
          {(["waze", "gmaps"] as const).map((app) => (
            <a
              key={app}
              href={navigationUrl(trip.destination, app)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setNavOpen(false)}
              className="flex h-14 items-center rounded-card border border-hairline bg-surface px-4 font-bold active:bg-surface-2"
            >
              {app === "waze" ? "Waze" : "Google Maps"}
            </a>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Banners({
  live,
  t,
}: {
  live: ReturnType<typeof useLiveTrip>;
  t: (k: TranslationKey, v?: Record<string, string | number>) => string;
}) {
  // A interface nunca finge que esta tudo bem: sem permissao, sem sinal ou com
  // posicoes na fila, quem esta olhando precisa saber.
  if (live.permission === "denied") {
    return (
      <Banner tone="split">
        <strong>{t("live.needLocation")}</strong> {t("live.needLocationCopy")}
      </Banner>
    );
  }
  if (!live.online) {
    return (
      <Banner tone="stretching">
        <strong>{t("conn.offline")}</strong>{" "}
        {live.queued > 0
          ? t("live.offlineQueued", { count: live.queued })
          : t("conn.offlineDetail")}
      </Banner>
    );
  }
  if (!live.myFix && live.permission !== "unsupported") {
    return <Banner tone="stretching">{t("live.waitingFix")}</Banner>;
  }
  return null;
}

function Banner({ tone, children }: { tone: "split" | "stretching"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "shrink-0 px-4 py-2.5 text-[13px] font-semibold leading-snug",
        tone === "split" ? "bg-split-soft text-split-ink" : "bg-stretching-soft text-stretching-ink",
      )}
    >
      {children}
    </div>
  );
}

function GroupList({
  vehicles,
  t,
  locale,
}: {
  vehicles: Vehicle[];
  t: (k: TranslationKey, v?: Record<string, string | number>) => string;
  locale: string;
}) {
  const sorted = [...vehicles].sort((a, b) => a.behindByM - b.behindByM);

  return (
    <div className="max-h-[26dvh] overflow-y-auto overscroll-contain">
      {sorted.map((v) => (
        <div key={v.id} className="flex items-center gap-3 py-2">
          <ParticipantAvatar
            name={v.driver.displayName}
            colorIndex={v.driver.colorIndex}
            size="sm"
            state={v.state}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold">
              {v.driver.displayName}
              {v.passengers.length > 0 && (
                <span className="font-semibold text-ink-50">
                  {" "}
                  +{v.passengers.map((p) => p.displayName).join(", ")}
                </span>
              )}
            </div>
            <div className="truncate text-[13px] font-semibold text-ink-50">
              {describe(v, t, locale)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado em linguagem humana — o principio de UX do §31. */
function describe(
  v: Vehicle,
  t: (k: TranslationKey, val?: Record<string, string | number>) => string,
  locale: string,
): string {
  if (v.state === "arrived") return t("member.arrived");
  if (v.state === "offline") {
    const src = v.source ?? v.driver;
    return t("member.offline", { ago: formatAgo(src.staleForMs, locale) });
  }
  if (v.state === "stopped") return t("member.stopped", { ago: "" }).trim();
  if (v.state === "off_route") return t("member.offRoute");
  if (v.behindByS < 30) return v.driver.isLeader ? t("member.leader") : t("member.onRoute");

  // Tempo primeiro, distancia como apoio: e o que a pessoa realmente quer saber.
  return `${t("member.behindTime", { time: formatDurationShort(v.behindByS) })} · ${formatDistance(
    v.behindByM,
    "km",
    locale,
  )}`;
}

function QuickButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Fuel;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-card border border-hairline bg-surface font-bold active:bg-surface-2"
    >
      <Icon className="size-6 text-konvo-500" strokeWidth={2.25} />
      <span className="text-[13px]">{label}</span>
    </button>
  );
}

function FullMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-10 text-center">
      <p className="text-[15px] font-semibold text-ink-50">{children}</p>
    </div>
  );
}
