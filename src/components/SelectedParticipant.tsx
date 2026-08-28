import { Navigation, Phone, X } from "lucide-react";

import { ParticipantAvatar } from "./ParticipantAvatar";
import { useI18n, useT } from "@/i18n";
import { formatDistance, formatDurationShort } from "@/lib/konvo/format";
import { navigationUrl } from "@/lib/services/routing";
import type { Vehicle } from "@/lib/konvo/types";

/**
 * Quem esta selecionado, e o que da para fazer a respeito.
 *
 * A diferenca entre rastrear e coordenar mora aqui. Saber que o Pedro esta
 * onze minutos atras e informacao; poder falar com ele, ligar, ou ir ate onde
 * ele esta e o que resolve a situacao.
 *
 * Aparece no lugar da lista do grupo, e nao empilhado sobre ela: com alguem em
 * foco, a lista inteira e ruido.
 */

interface Props {
  vehicle: Vehicle;
  isMe: boolean;
  onClose: () => void;
  onTalk: () => void;
}

export function SelectedParticipant({ vehicle, isMe, onClose, onTalk }: Props) {
  const t = useT();
  const { locale } = useI18n();

  const person = vehicle.source ?? vehicle.driver;
  const phone = (vehicle.driver as { phone?: string | null }).phone;
  const pos = person.fix;

  return (
    <div className="animate-rise">
      <div className="flex items-center gap-3">
        <ParticipantAvatar
          name={person.displayName}
          colorIndex={vehicle.driver.colorIndex}
          avatarUrl={person.avatarUrl}
          size="md"
          short
          state={vehicle.state}
        />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold leading-tight">
            {vehicle.driver.displayName}
            {vehicle.passengers.length > 0 && (
              <span className="font-semibold text-ink-50">
                {" "}
                +{vehicle.passengers.map((p) => p.displayName).join(", ")}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[13px] font-semibold text-ink-50">
            {describe(vehicle, t, locale)}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t("live.cancel")}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-35 active:bg-surface-2"
        >
          <X className="size-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Acoes sobre ESTA pessoa. Sem elas o mapa so rastreia; com elas,
          coordena. */}
      {!isMe && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Action onClick={onTalk} label={t("live.holdToTalk")}>
            <span className="text-[13px] font-extrabold">{t("nav.inbox")}</span>
          </Action>

          {pos ? (
            <ActionLink
              href={navigationUrl(pos, "waze")}
              label={t("live.navigateTo", { name: vehicle.driver.displayName })}
            >
              <Navigation className="size-[17px]" strokeWidth={2.5} />
              <span className="text-[13px] font-extrabold">{t("live.goTo")}</span>
            </ActionLink>
          ) : (
            <Action disabled label="">
              <Navigation className="size-[17px]" strokeWidth={2.5} />
              <span className="text-[13px] font-extrabold">{t("live.goTo")}</span>
            </Action>
          )}

          {phone ? (
            <ActionLink href={`tel:${phone}`} label={t("live.call")}>
              <Phone className="size-[17px]" strokeWidth={2.5} />
              <span className="text-[13px] font-extrabold">{t("live.call")}</span>
            </ActionLink>
          ) : (
            <Action disabled label="">
              <Phone className="size-[17px]" strokeWidth={2.5} />
              <span className="text-[13px] font-extrabold">{t("live.call")}</span>
            </Action>
          )}
        </div>
      )}
    </div>
  );
}

function Action({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 items-center justify-center gap-1.5 rounded-card border border-hairline bg-surface text-ink-70 active:bg-surface-2 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function ActionLink({
  children,
  href,
  label,
}: {
  children: React.ReactNode;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex h-12 items-center justify-center gap-1.5 rounded-card border border-hairline bg-surface text-ink-70 active:bg-surface-2"
    >
      {children}
    </a>
  );
}

/** Estado em linguagem humana — o principio de UX do §31. */
function describe(
  v: Vehicle,
  t: ReturnType<typeof useT>,
  locale: string,
): string {
  if (v.state === "arrived") return t("member.arrived");
  if (v.state === "offline") return t("member.offline", { ago: "" }).trim();
  if (v.state === "stopped") return t("member.stopped", { ago: "" }).trim();
  if (v.state === "off_route") return t("member.offRoute");
  if (v.behindByS < 45) return t("member.onRoute");

  return `${t("member.behindTime", { time: formatDurationShort(v.behindByS) })} · ${formatDistance(
    v.behindByM,
    "km",
    locale,
  )}`;
}
