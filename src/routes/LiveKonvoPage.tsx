import { useCallback, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Fuel,
  Navigation,
  Layers3,
  Map as MapIcon,
  Pause,
  Play,
  Toilet,
  UserPlus,
  UtensilsCrossed,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { ActionBar } from "@/components/ActionBar";
import { BottomSheet } from "@/components/BottomSheet";
import { CallSheet } from "@/components/CallSheet";
import { InviteSheet } from "@/components/InviteSheet";
import { KonvoMap, type CameraMode } from "@/components/KonvoMap";
import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { StatusPill } from "@/components/StatusPill";
import { useLiveTrip } from "@/hooks/useLiveTrip";
import { useSimulatedTrip } from "@/hooks/useSimulatedTrip";
import { useVoiceNotes } from "@/hooks/useVoiceNotes";
import { useI18n, useT } from "@/i18n";
import { logEvent, sendQuickAction } from "@/lib/db/live";
import { navigationUrl } from "@/lib/services/routing";
import { SCENARIOS, SCENARIO_ORDER, type ScenarioId } from "@/lib/konvo/simulator";
import { formatAgo, formatDistance, formatDuration, formatDurationShort } from "@/lib/konvo/format";
import { cn } from "@/lib/utils";
import type { QuickActionKind, Vehicle } from "@/lib/konvo/types";
import type { TranslationKey } from "@/i18n/en";

/**
 * Live Konvo — a tela mais importante do produto (brief §11).
 *
 * Estrutura, de cima para baixo:
 *   1. quem esta junto, em uma frase
 *   2. o mapa, ocupando a maior parte
 *   3. as acoes, ao alcance do polegar
 *   4. quem esta onde, em texto
 *
 * O mapa e o maior elemento, mas nao e o mais importante: o §31 diz que a
 * pessoa nao deveria precisar interpretar pontinhos. A frase no topo e a
 * resposta; o mapa e a confirmacao.
 *
 * Nenhum calculo acontece aqui — tudo vem derivado do hook.
 */

interface Props {
  /** modo demonstracao: carros simulados sobre a rota real, sem banco */
  demo?: boolean;
}

export function LiveKonvoPage({ demo = false }: Props) {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();

  const [scenario, setScenario] = useState<ScenarioId>("together");
  const [playing, setPlaying] = useState(true);
  const [camera, setCamera] = useState<CameraMode>("overview");

  // Os dois hooks sao sempre chamados (regra dos hooks); o desativado nao faz
  // trabalho nenhum.
  const real = useLiveTrip(demo ? undefined : tripId);
  const sim = useSimulatedTrip(demo, scenario, playing);
  const live = demo ? sim : real;

  const [actionsOpen, setActionsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmEmergency, setConfirmEmergency] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { trip, me, vehicles, status } = live;

  const nameOf = useCallback(
    (memberId: string | null) =>
      live.members.find((m) => m.id === memberId)?.displayName ?? "",
    [live.members],
  );
  const { speaking } = useVoiceNotes(demo ? undefined : tripId, me?.id ?? null, nameOf);

  if (live.loading) return <FullMessage>…</FullMessage>;
  if (live.error || !trip) return <FullMessage>{live.error ?? t("join.notFound")}</FullMessage>;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const quick = async (kind: QuickActionKind, label: string) => {
    setActionsOpen(false);
    flash(label);
    navigator.vibrate?.(20);
    if (demo || !me || !tripId) return;
    await sendQuickAction(tripId, me.id, kind, me.displayName).catch(() => {});
  };

  const lead = vehicles.reduce<Vehicle | null>(
    (a, b) => (a === null || b.behindByM < a.behindByM ? b : a),
    null,
  );

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* --- 1. cabecalho + estado do grupo --------------------------------- */}
      <header className="safe-top z-20 shrink-0 border-b border-hairline bg-canvas">
        <div className="flex h-14 items-center gap-1 px-2">
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
          {!demo && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              aria-label={t("invite.title")}
              className="grid size-10 shrink-0 place-items-center rounded-full active:bg-surface-2"
            >
              <UserPlus className="size-[21px]" strokeWidth={2.25} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="mr-1 flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-surface-2 px-3 text-[13px] font-bold"
          >
            <Navigation className="size-4" strokeWidth={2.5} />
            {t("live.navigate")}
          </button>
        </div>

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
            {lead?.remainingM != null && lead.etaS != null && (
              <span className="tnum ml-auto shrink-0 text-[13px] font-bold text-ink-50">
                {formatDistance(lead.remainingM, "km", locale)} ·{" "}
                {formatDuration(lead.etaS, locale)}
              </span>
            )}
          </div>
        )}
      </header>

      {speaking ? (
        <div className="shrink-0 bg-konvo-500 px-4 py-2.5 text-[13px] font-bold text-white">
          {t("live.isTalking", { name: speaking })}
        </div>
      ) : (
        !demo && <Banners live={real} t={t} />
      )}

      {demo && (
        <div className="shrink-0 bg-konvo-50 px-4 py-2 text-[12px] font-bold text-konvo-700">
          {t("live.demoBanner")}
        </div>
      )}

      {/* --- 2. mapa --------------------------------------------------------- */}
      <div className="relative min-h-0 flex-1">
        <KonvoMap
          route={live.route}
          vehicles={vehicles}
          destination={trip.destination}
          camera={camera}
          meId={me?.id ?? null}
          className=""
        />

        {/* Alternar visao, como num app de navegacao: de cima para entender o
            trajeto, atras do carro para dirigir. */}
        <button
          type="button"
          onClick={() => setCamera((c) => (c === "overview" ? "follow" : "overview"))}
          aria-label={t("live.camera")}
          className="absolute right-3 top-3 flex h-11 items-center gap-2 rounded-pill bg-surface/95 px-3.5 font-bold shadow-card backdrop-blur active:bg-surface-2"
        >
          {camera === "overview" ? (
            <Layers3 className="size-[18px] text-konvo-500" strokeWidth={2.4} />
          ) : (
            <MapIcon className="size-[18px] text-konvo-500" strokeWidth={2.4} />
          )}
          <span className="text-[13px]">
            {camera === "overview" ? t("live.cameraFollow") : t("live.cameraTop")}
          </span>
        </button>

        {toast && (
          <div className="pointer-events-none absolute inset-x-4 top-3 rounded-pill bg-ink/90 px-4 py-2.5 text-center text-[13px] font-bold text-canvas">
            {toast}
          </div>
        )}

        {demo && (
          <DemoControls
            scenario={scenario}
            onScenario={setScenario}
            playing={playing}
            onPlaying={setPlaying}
            t={t}
          />
        )}
      </div>

      {/* --- 3. acoes + 4. quem esta onde ------------------------------------ */}
      <div className="safe-bottom z-20 shrink-0 border-t border-hairline bg-surface px-4 pb-3 pt-3">
        <ActionBar
          tripId={tripId ?? "demo"}
          memberId={me?.id ?? null}
          listenerCount={Math.max(0, vehicles.length - 1)}
          demo={demo}
          onAttention={() => void quick("attention", t("live.attention"))}
          onCall={() => setCallOpen(true)}
          onStop={() => setActionsOpen(true)}
        />

        <div className="mt-3 border-t border-hairline pt-2">
          <GroupList vehicles={vehicles} t={t} locale={locale} />
        </div>
      </div>

      {/* --- folhas ---------------------------------------------------------- */}
      <BottomSheet open={actionsOpen} onOpenChange={setActionsOpen} title={t("live.quickActions")}>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickButton icon={Fuel} label={t("quick.gas")} onClick={() => void quick("gas", t("quick.gas"))} />
          <QuickButton icon={Toilet} label={t("quick.bathroom")} onClick={() => void quick("bathroom", t("quick.bathroom"))} />
          <QuickButton icon={UtensilsCrossed} label={t("quick.food")} onClick={() => void quick("food", t("quick.food"))} />
          <QuickButton icon={Play} label={t("quick.ok")} onClick={() => void quick("ok", t("quick.ok"))} />
        </div>

        {/* Emergencia separada, vermelha e com confirmacao: toque acidental nao
            pode alarmar a familia inteira na estrada. */}
        <button
          type="button"
          onClick={() => {
            setActionsOpen(false);
            setConfirmEmergency(true);
          }}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-card bg-split-soft font-bold text-split-ink active:opacity-80"
        >
          <AlertTriangle className="size-[18px]" strokeWidth={2.5} />
          {t("live.emergency")}
        </button>
      </BottomSheet>

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
              flash(t("live.emergency"));
              navigator.vibrate?.([100, 60, 100]);
              if (demo || !me || !tripId) return;
              await logEvent(tripId, me.id, "quick_action", {
                kind: "problem",
                name: me.displayName,
                lat: live.myFix?.lat,
                lng: live.myFix?.lng,
              }).catch(() => {});
            }}
            className="rounded-card bg-split py-3.5 font-extrabold text-white active:opacity-90"
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

      <CallSheet
        open={callOpen}
        onOpenChange={setCallOpen}
        members={live.members}
        meId={me?.id ?? null}
      />

      {!demo && (
        <InviteSheet
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          tripName={trip.name}
          code={trip.code}
        />
      )}

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

/** Painel de simulacao (brief §27) — so no modo demonstracao. */
function DemoControls({
  scenario,
  onScenario,
  playing,
  onPlaying,
  t,
}: {
  scenario: ScenarioId;
  onScenario: (s: ScenarioId) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
  t: (k: TranslationKey) => string;
}) {
  return (
    <div className="absolute inset-x-3 bottom-3 rounded-card bg-surface/95 p-2 shadow-card backdrop-blur">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPlaying(!playing)}
          aria-label={playing ? t("live.pause") : t("live.play")}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-konvo-500 text-white"
        >
          {playing ? (
            <Pause className="size-[17px]" strokeWidth={2.5} />
          ) : (
            <Play className="size-[17px]" strokeWidth={2.5} />
          )}
        </button>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {SCENARIO_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onScenario(id)}
              className={cn(
                "shrink-0 rounded-pill px-3 py-1.5 text-[12px] font-bold",
                scenario === id ? "bg-konvo-500 text-white" : "bg-surface-2 text-ink-50",
              )}
            >
              {SCENARIOS[id].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Banners({
  live,
  t,
}: {
  live: ReturnType<typeof useLiveTrip>;
  t: (k: TranslationKey, v?: Record<string, string | number>) => string;
}) {
  // A interface nunca finge que esta tudo bem.
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
        {live.queued > 0 ? t("live.offlineQueued", { count: live.queued }) : t("conn.offlineDetail")}
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
    <div className="max-h-[22dvh] overflow-y-auto overscroll-contain">
      {sorted.map((v) => (
        <div key={v.id} className="flex items-center gap-3 py-2">
          <ParticipantAvatar
            name={v.driver.displayName}
            colorIndex={v.driver.colorIndex}
            size="sm"
            short
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

  // Tempo primeiro, distancia como apoio: e o que a pessoa quer saber.
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
