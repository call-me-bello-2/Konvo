import { useEffect, useState } from "react";
import { ChevronRight, Radio, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { ChevronMotif } from "@/components/ChevronMotif";
import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { useMyTrips } from "@/hooks/useMyTrips";
import { supabase } from "@/lib/supabase";
import { useI18n, useT } from "@/i18n";
import { formatAgo } from "@/lib/konvo/format";
import { toMember, type MemberRow } from "@/lib/db/trips";
import type { TripMember } from "@/lib/konvo/types";

/**
 * Conversa (brief §21).
 *
 * Uma linha por VIAGEM, e nao um log solto de eventos. A pergunta que a pessoa
 * traz aqui e "com quem eu falo?", e a resposta e sempre um grupo — o pessoal
 * daquela viagem.
 *
 * Entrar numa viagem ja coloca a pessoa na conversa: nao ha lista de amigos
 * para montar, nem convite separado para aceitar. Quem esta no mesmo Konvo
 * fala com quem esta no mesmo Konvo, e ponto.
 */

interface Row {
  tripId: string;
  name: string;
  members: TripMember[];
  lastText: string | null;
  lastAt: number | null;
}

export function ActivityPage() {
  const t = useT();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { trips, loading: tripsLoading } = useMyTrips();

  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (tripsLoading) return;
    if (trips.length === 0) {
      setRows([]);
      return;
    }

    const ids = trips.map((s) => s.trip.id);

    void Promise.all([
      supabase.from("trip_members").select("*").in("trip_id", ids),
      supabase
        .from("trip_events")
        .select("trip_id, type, payload, created_at")
        .in("trip_id", ids)
        .order("created_at", { ascending: false })
        .limit(120),
    ]).then(([m, e]) => {
      const byTrip = new Map<string, TripMember[]>();
      for (const raw of (m.data as MemberRow[] | null) ?? []) {
        const list = byTrip.get(raw.trip_id) ?? [];
        list.push(toMember(raw));
        byTrip.set(raw.trip_id, list);
      }

      const lastByTrip = new Map<string, { text: string; at: number }>();
      for (const ev of (e.data as { trip_id: string; type: string; created_at: string }[] | null) ??
        []) {
        if (lastByTrip.has(ev.trip_id)) continue;
        lastByTrip.set(ev.trip_id, { text: ev.type, at: Date.parse(ev.created_at) });
      }

      setRows(
        trips.map((s) => ({
          tripId: s.trip.id,
          name: s.trip.name,
          members: byTrip.get(s.trip.id) ?? [],
          lastText: lastByTrip.get(s.trip.id)?.text ?? null,
          lastAt: lastByTrip.get(s.trip.id)?.at ?? null,
        })),
      );
    });
  }, [trips, tripsLoading]);

  if (tripsLoading || rows === null) {
    return (
      <div className="grid h-full place-items-center">
        <ChevronMotif className="opacity-40" />
      </div>
    );
  }

  // Sem conversa nenhuma, o que falta nao e conteudo — e gente.
  if (rows.length === 0) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div className="w-full max-w-xs">
          <ChevronMotif className="mx-auto mb-5" />
          <h2 className="text-[20px] font-extrabold">{t("inbox.emptyInvite")}</h2>
          <p className="mt-1.5 text-[14px] font-semibold leading-snug text-ink-50">
            {t("inbox.emptyInviteCopy")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/new?mode=together")}
            className="mt-6 w-full rounded-pill bg-konvo-500 font-extrabold text-white active:bg-konvo-600"
            style={{ height: 52 }}
          >
            {t("inbox.startKonvo")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="mb-4 text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
        {t("nav.inbox")}
      </h1>

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <Link
            key={r.tripId}
            to={`/konvo/${r.tripId}`}
            className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-3 shadow-card active:bg-surface-2"
          >
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-konvo-50 text-konvo-500">
              <Radio className="size-6" strokeWidth={2.25} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-extrabold leading-tight">{r.name}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-50">
                <Users className="size-[14px] shrink-0" strokeWidth={2.5} />
                {t("count.people", { count: r.members.length })}
                {r.lastAt && (
                  <>
                    <span className="text-ink-35">·</span>
                    <span className="truncate">{formatAgo(Date.now() - r.lastAt, locale)}</span>
                  </>
                )}
              </div>

              {/* As caras de quem esta ali: e o que faz reconhecer o grupo antes
                  de ler o nome da viagem. */}
              <div className="mt-2 flex -space-x-2">
                {r.members.slice(0, 5).map((m) => (
                  <ParticipantAvatar
                    key={m.id}
                    name={m.displayName}
                    colorIndex={m.colorIndex}
                    avatarUrl={m.avatarUrl}
                    size="sm"
                    short
                    ring
                  />
                ))}
                {r.members.length > 5 && (
                  <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-ink-50 ring-[2.5px] ring-surface">
                    +{r.members.length - 5}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
          </Link>
        ))}
      </div>
    </div>
  );
}
