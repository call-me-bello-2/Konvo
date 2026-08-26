import { useEffect, useState } from "react";
import { Bell, Flag, Fuel, MapPin, Radio, Split, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { BottomSheet } from "./BottomSheet";
import { ChevronMotif } from "./ChevronMotif";
import { supabase } from "@/lib/supabase";
import { useI18n, useT } from "@/i18n";
import { formatAgo } from "@/lib/konvo/format";
import type { TranslationKey } from "@/i18n/en";

/**
 * Notificacoes, em folha sobre a tela.
 *
 * Antes o sino levava para outra pagina. Ver o que aconteceu nao deveria custar
 * sair de onde a pessoa esta — ainda mais durante uma viagem, quando sair da
 * tela do mapa e justamente o que ninguem quer.
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
  member_stopped: MapPin,
  member_arrived: Flag,
  voice_note: Radio,
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationSheet({ open, onOpenChange }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const [events, setEvents] = useState<EventRow[] | null>(null);

  // So busca quando abre: nao ha motivo para consultar o banco por causa de um
  // sino que a pessoa talvez nunca toque.
  useEffect(() => {
    if (!open) return;
    supabase
      .from("trip_events")
      .select("*, trips(name), trip_members(display_name)")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setEvents((data as EventRow[] | null) ?? []));
  }, [open]);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("notif.title")}>
      {events === null ? (
        <div className="grid place-items-center py-10">
          <ChevronMotif className="opacity-40" />
        </div>
      ) : events.length === 0 ? (
        <div className="grid place-items-center px-6 py-8 text-center">
          <Bell className="mb-3 size-7 text-ink-35" strokeWidth={2} />
          <p className="text-[16px] font-extrabold">{t("notif.empty")}</p>
          <p className="mt-1 text-[13px] font-semibold text-ink-50">{t("notif.emptyCopy")}</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {events.map((e, i) => {
            const Icon = ICON[e.type] ?? MapPin;
            const key = LABEL[e.type] ?? "event.tripStarted";
            const who =
              e.trip_members?.display_name ?? (e.payload?.name as string | undefined) ?? "";

            return (
              <Link
                key={e.id}
                to={`/konvo/${e.trip_id}`}
                onClick={() => onOpenChange(false)}
                className={
                  "flex items-center gap-3 py-3 " +
                  (i < events.length - 1 ? "border-b border-hairline" : "")
                }
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-50">
                  <Icon className="size-[18px]" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{t(key, { name: who })}</div>
                  <div className="truncate text-[13px] font-semibold text-ink-35">
                    {e.trips?.name ? `${e.trips.name} · ` : ""}
                    {formatAgo(Date.now() - Date.parse(e.created_at), locale)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
