import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import { TransportPicker } from "@/components/TransportPicker";
import { useT } from "@/i18n";
import { useSession } from "@/session";
import {
  getMembers,
  getTripPreview,
  joinTrip,
  updateMyMemberProfile,
  type TripPreview,
} from "@/lib/db/trips";
import { cn } from "@/lib/utils";
import type { TransportType, TripMember } from "@/lib/konvo/types";

/**
 * Entrar por convite (brief §10).
 *
 * Precisa ser a tela de menor atrito do app: quem abre isso normalmente esta
 * com pressa, no celular, prestes a sair. Pede nome e veiculo. Nada mais.
 */

export function JoinKonvoPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { displayName, setDisplayName, phone, setPhone, avatarUrl, setAvatarUrl } =
    useSession();

  const [preview, setPreview] = useState<TripPreview | null>(null);
  const [drivers, setDrivers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(displayName);
  const [transport, setTransport] = useState<TransportType>("car");
  const [ridingWith, setRidingWith] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    getTripPreview(code)
      .then(async (p) => {
        setPreview(p);
        if (p) {
          // Precisamos da lista de condutores para o caso de "passageiro".
          const members = await getMembers(p.tripId).catch(() => []);
          setDrivers(members.filter((m) => m.transport !== "passenger"));
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  const submit = async () => {
    if (!code || !name.trim()) return;
    setJoining(true);
    setError(null);
    try {
      setDisplayName(name.trim());
      const tripId = await joinTrip({
        code,
        displayName: name.trim(),
        transport,
        ridingWith: transport === "passenger" ? ridingWith : null,
        avatarUrl,
      });
      await updateMyMemberProfile(tripId, { phone, avatarUrl }).catch(() => {});
      navigate(`/konvo/${tripId}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setJoining(false);
    }
  };

  if (loading) return <Centered>…</Centered>;
  if (!preview) return <Centered>{t("join.notFound")}</Centered>;

  const canSubmit =
    name.trim().length > 0 &&
    (transport !== "passenger" || ridingWith !== null || drivers.length === 0);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-10">
        <img src="/brand/wordmark.png" alt="Konvo" className="mb-8 h-[26px] w-auto" />

        <p className="text-[15px] font-semibold text-ink-50">
          {t("join.invited", { name: preview.hostName ?? "" })}
        </p>
        <h1 className="mt-1 text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
          {preview.name}
        </h1>
        <p className="mt-2 text-[15px] font-semibold text-ink-50">
          {t("count.people", { count: preview.memberCount })}
        </p>

        <h2 className="mb-2 mt-8 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
          {t("new.yourName")}
        </h2>
        <div className="flex items-center gap-3">
          <AvatarPicker
            name={name}
            colorIndex={1}
            value={avatarUrl}
            onChange={setAvatarUrl}
            size="md"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("new.yourName")}
            className="min-w-0 flex-1 rounded-card border border-hairline bg-surface px-4 font-semibold shadow-card outline-none placeholder:text-ink-35"
            style={{ height: 52 }}
            autoFocus
          />
        </div>

        {/* Telefone e o plano B: se o app falhar, o grupo ainda liga. */}
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder={t("new.phone")}
          className="mt-2 w-full rounded-card border border-hairline bg-surface px-4 font-semibold shadow-card outline-none placeholder:text-ink-35"
          style={{ height: 52 }}
        />
        <p className="mt-1.5 text-[12.5px] font-semibold text-ink-35">{t("new.phoneCopy")}</p>

        <h2 className="mb-2 mt-6 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
          {t("new.howYouGo")}
        </h2>
        <TransportPicker value={transport} onChange={setTransport} />

        {/* Passageiro escolhe de quem e o carro. E isso que faz a contagem de
            veiculos bater e o carro nao virar dois pinos no mesmo lugar. */}
        {transport === "passenger" && drivers.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
              {t("new.withWho")}
            </h2>
            <div className="flex flex-col gap-2">
              {drivers.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setRidingWith(d.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-card border px-4 py-3 text-left font-bold",
                    ridingWith === d.id
                      ? "border-konvo-500 bg-konvo-50"
                      : "border-hairline bg-surface",
                  )}
                >
                  <ParticipantAvatar
                    name={d.displayName}
                    colorIndex={d.colorIndex}
                    size="sm"
                    short
                  />
                  {d.displayName}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-4 text-[13px] font-semibold text-split-ink">{error}</p>}
      </div>

      <div className="safe-bottom shrink-0 border-t border-hairline bg-surface px-4 py-3">
        <button
          type="button"
          disabled={!canSubmit || joining}
          onClick={() => void submit()}
          className="h-14 w-full rounded-pill bg-konvo-500 text-[16px] font-extrabold text-white active:bg-konvo-600 disabled:opacity-35"
        >
          {joining ? t("join.joining") : t("join.join")}
        </button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-10 text-center">
      <p className="text-[15px] font-semibold text-ink-50">{children}</p>
    </div>
  );
}
