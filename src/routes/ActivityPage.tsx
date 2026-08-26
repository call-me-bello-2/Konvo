import { useEffect, useState } from "react";
import { Flag, Fuel, MapPin, PauseCircle, Split, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { ChevronMotif } from "@/components/ChevronMotif";
import { supabase } from "@/lib/supabase";
import { useI18n, useT } from "@/i18n";
import { useSession } from "@/session";
import { formatAgo } from "@/lib/konvo/format";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/en";

/**
 * Activity (brief §21) — caixa de entrada, nao feed social.
 *
 * O que aconteceu nas viagens da pessoa, em ordem. Sem posts, curtidas,
 * seguidores ou metricas publicas (§35).
 */

interface EventRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  trip_id: string;
  trips: { name: string } | null;
  trip_members: { display_name: string } | null;
}

const ICON: Record<string, typeof MapPin> = {
  member_joined: UserPlus,
  member_left: UserPlus,
  trip_started: Flag,
  trip_completed: Flag,
  stop_proposed: MapPin,
  stop_accepted: MapPin,
  quick_action: Fuel,
  group_split: Split,
  group_rejoined: Users,
  member_stopped: PauseCircle,
  member_arrived: Flag,
  voice_note: Users,
};

const LABEL: Record<string, TranslationKey> = {
  member_joined: "event.memberJoined",
  member_left: "event.memberLeft",
  trip_started: "event.tripStarted",
  trip_completed: "event.tripCompleted",
  stop_proposed: "event.stopProposed",
  stop_accepted: "event.stopAccepted",
  quick_action: "event.stopProposed",
  group_split: "event.groupSplit",
  group_rejoined: "event.groupRejoined",
  member_stopped: "event.memberStopped",
  member_arrived: "event.memberArrived",
  voice_note: "event.voiceNote",
};

export function ActivityPage() {
  const t = useT();
  const { locale } = useI18n();
  const { userId, loading: sessionLoading } = useSession();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }

    // O RLS ja limita aos eventos das viagens da pessoa.
    supabase
      .from("trip_events")
      .select("*, trips(name), trip_members(display_name)")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setEvents((data as EventRow[] | null) ?? []);
        setLoading(false);
      });
  }, [userId, sessionLoading]);

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <ChevronMotif className="opacity-40" />
      </div>
    );
  }

  if (events.length === 0) {
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
      <h1 className="mb-4 text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
        {t("activity.title")}
      </h1>

      <div className="flex flex-col">
        {events.map((e, i) => {
          const Icon = ICON[e.type] ?? MapPin;
          const key = LABEL[e.type] ?? "event.tripStarted";
          const who =
            e.trip_members?.display_name ?? (e.payload?.name as string | undefined) ?? "";
          const ageMs = Date.now() - Date.parse(e.created_at);

          return (
            <Link
              key={e.id}
              to={`/konvo/${e.trip_id}`}
              className={cn(
                "flex items-center gap-3 py-3.5",
                i < events.length - 1 && "border-b border-hairline",
              )}
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-50">
                <Icon className="size-[19px]" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold">{t(key, { name: who })}</div>
                <div className="truncate text-[13px] font-semibold text-ink-35">
                  {e.trips?.name ? `${e.trips.name} · ` : ""}
                  {formatAgo(ageMs, locale)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
