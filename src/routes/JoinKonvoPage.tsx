import { useEffect, useState } from "react";
import { Bike, Bus, Car, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { useT } from "@/i18n";
import { useSession } from "@/session";
import { getMembers, getTripPreview, joinTrip, type TripPreview } from "@/lib/db/trips";
import { cn } from "@/lib/utils";
import type { TransportType, TripMember } from "@/lib/konvo/types";

/**
 * Entrar por convite (brief §10).
 *
 * Precisa ser a tela de menor atrito do app: quem abre isso normalmente esta
 * com pressa, no celular, prestes a sair. Pede nome e veiculo. Nada mais.
 */

const TRANSPORTS: {
  value: TransportType;
  icon: typeof Car;
  key: "transport.car" | "transport.motorcycle" | "transport.bus" | "transport.passenger";
}[] = [
  { value: "car", icon: Car, key: "transport.car" },
  { value: "motorcycle", icon: Bike, key: "transport.motorcycle" },
  { value: "bus", icon: Bus, key: "transport.bus" },
  { value: "passenger", icon: User, key: "transport.passenger" },
];

export function JoinKonvoPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { displayName, setDisplayName } = useSession();

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
      });
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
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("new.yourName")}
          className="w-full rounded-card border border-hairline bg-surface px-4 font-semibold shadow-card outline-none placeholder:text-ink-35"
          style={{ height: 52 }}
          autoFocus
        />

        <h2 className="mb-2 mt-6 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
          {t("new.howYouGo")}
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {TRANSPORTS.map(({ value, icon: Icon, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTransport(value)}
              className={cn(
                "flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-card border font-bold",
                transport === value
                  ? "border-konvo-500 bg-konvo-50 text-konvo-500"
                  : "border-hairline bg-surface text-ink-50",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={2.25} />
              <span className="text-[11px]">{t(key)}</span>
            </button>
          ))}
        </div>

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
