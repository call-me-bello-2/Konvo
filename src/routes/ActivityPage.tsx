import { useState } from "react";
import {
  Flag,
  Fuel,
  MapPin,
  PauseCircle,
  SplitSquareHorizontal,
  UserPlus,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ChevronMotif } from "./TripsPage";
import { ParticipantAvatar, participantColor } from "@/components/ParticipantAvatar";
import { demoEvents, type DemoEvent } from "@/data/demo";
import { useI18n, useT } from "@/i18n";
import { formatAgo } from "@/lib/konvo/format";
import { cn } from "@/lib/utils";
import type { TFn } from "@/i18n";
import type { TranslationKey } from "@/i18n/en";

/**
 * Activity (brief §21) — caixa de entrada, nao feed social.
 *
 * Unifica o sino da top bar com a aba: um lugar so para "o que aconteceu".
 * Eventos de todas as viagens, com nao-lidos, e botao nos que pedem decisao.
 *
 * Sem posts, curtidas, seguidores ou metricas publicas (§35).
 */

const ICON: Record<DemoEvent["type"], typeof MapPin> = {
  member_joined: UserPlus,
  stop_proposed: Fuel,
  stop_accepted: MapPin,
  group_split: SplitSquareHorizontal,
  group_rejoined: Users,
  member_stopped: PauseCircle,
  trip_completed: Flag,
  quick_action: Fuel,
};

const LABEL: Record<DemoEvent["type"], TranslationKey> = {
  member_joined: "event.memberJoined",
  stop_proposed: "event.stopProposed",
  stop_accepted: "event.stopAccepted",
  group_split: "event.groupSplit",
  group_rejoined: "event.groupRejoined",
  member_stopped: "event.memberStopped",
  trip_completed: "event.tripCompleted",
  quick_action: "event.stopProposed",
};

export function ActivityPage() {
  const t = useT();
  const { locale } = useI18n();

  // Marcar como lido e local por enquanto; vai virar `activity_read_at` no
  // membro assim que o Supabase estiver ligado.
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unread = demoEvents.filter((e) => e.unread && !readIds.has(e.id));

  if (demoEvents.length === 0) {
    return (
      <div className="grid h-full place-items-center px-10 text-center">
        <div>
          <ChevronMotif className="mx-auto mb-5" />
          <h2 className="text-[20px] font-extrabold">{t("activity.empty")}</h2>
          <p className="mt-1.5 text-[14px] font-semibold text-ink-50">
            {t("activity.emptyCopy")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
          {t("activity.title")}
        </h1>
        {unread.length > 0 && (
          <button
            type="button"
            onClick={() => setReadIds(new Set(demoEvents.map((e) => e.id)))}
            className="shrink-0 text-[13px] font-bold text-konvo-500"
          >
            {t("activity.markAllRead")}
          </button>
        )}
      </div>

      <div className="flex flex-col">
        {demoEvents.map((e, i) => (
          <EventRow
            key={e.id}
            event={e}
            read={!e.unread || readIds.has(e.id)}
            last={i === demoEvents.length - 1}
            t={t}
            locale={locale}
            onRead={() => setReadIds((prev) => new Set(prev).add(e.id))}
          />
        ))}
      </div>
    </div>
  );
}

function EventRow({
  event,
  read,
  last,
  t,
  locale,
  onRead,
}: {
  event: DemoEvent;
  read: boolean;
  last: boolean;
  t: TFn;
  locale: string;
  onRead: () => void;
}) {
  const Icon = ICON[event.type];
  const color = event.colorIndex ? participantColor(event.colorIndex) : undefined;

  return (
    <div
      className={cn("flex gap-3 py-3.5", !last && "border-b border-hairline")}
      onClick={onRead}
    >
      {/* Quem tem autor aparece pelo avatar; evento do grupo, por icone. Manter
          a cor da pessoa aqui e o que liga o evento ao pino no mapa. */}
      {event.actor && event.colorIndex ? (
        <ParticipantAvatar
          name={event.actor}
          colorIndex={event.colorIndex}
          size="md"
          short
        />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-50">
          <Icon className="size-[19px]" strokeWidth={2.25} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className={cn("text-[15px] leading-snug", read ? "font-semibold" : "font-extrabold")}>
              {t(LABEL[event.type], { name: event.actor ?? "" })}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-35">
              {event.actor && event.colorIndex && (
                <Icon className="size-3.5 shrink-0" strokeWidth={2.5} style={{ color }} />
              )}
              <span className="truncate">
                {event.tripName} · {formatAgo(event.agoMin * 60_000, locale)}
              </span>
            </div>
          </div>

          {!read && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-konvo-500" />}
        </div>

        {event.action && (
          <div className="mt-2.5 flex gap-2">
            {event.action === "addStop" ? (
              <>
                <button
                  type="button"
                  className="h-9 rounded-pill bg-konvo-500 px-4 text-[13px] font-bold text-white active:bg-konvo-600"
                >
                  {t("activity.addForEveryone")}
                </button>
                <Link
                  to={`/konvo/${event.tripId}`}
                  className="grid h-9 place-items-center rounded-pill bg-surface-2 px-4 text-[13px] font-bold text-ink-70"
                >
                  {t("activity.view")}
                </Link>
              </>
            ) : (
              <Link
                to={`/konvo/${event.tripId}`}
                className="grid h-9 place-items-center rounded-pill bg-surface-2 px-4 text-[13px] font-bold text-ink-70"
              >
                {t("activity.view")}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
