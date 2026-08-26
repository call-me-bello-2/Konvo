import { useState } from "react";
import { ChevronRight, LogOut, Phone } from "lucide-react";

import { ParticipantAvatar } from "@/components/ParticipantAvatar";
import { demoProfile } from "@/data/demo";
import { useI18n, useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/theme";
import type { Locale } from "@/i18n";

/**
 * You (brief §22).
 *
 * So o que muda comportamento na estrada. Notificacoes, privacidade, historico
 * e apagar conta ficam de fora por ora: sao quatro telas que ninguem abre
 * durante uma viagem, e o tempo ate 23/09 vale mais no Live Konvo.
 *
 * Fora por decisao do brief §22: seguidores, posts, garagem, badges, pontos,
 * ranking, metricas publicas.
 */

export function ProfilePage() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const [nav, setNav] = useState(demoProfile.navigateWith);
  const [unit, setUnit] = useState(demoProfile.distanceUnit);
  const [shareOnlyDuringTrips, setShareOnlyDuringTrips] = useState(
    demoProfile.shareOnlyDuringTrips,
  );

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="mb-4 text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
        {t("you.title")}
      </h1>

      <div className="mb-6 flex items-center gap-3.5">
        <ParticipantAvatar
          name={demoProfile.name}
          colorIndex={demoProfile.colorIndex}
          size="lg"
        />
        <div className="min-w-0">
          <div className="truncate text-[20px] font-extrabold leading-tight">
            {demoProfile.name}
          </div>
        </div>
      </div>

      {/* --- preferencias que a viagem usa ---------------------------------- */}
      <Group>
        {/* Alimenta o §17: o Konvo nao navega, so abre o app que a pessoa usa. */}
        <SegmentRow
          label={t("you.navigateWith")}
          value={nav}
          options={[
            { value: "waze" as const, label: "Waze" },
            { value: "gmaps" as const, label: "Google Maps" },
          ]}
          onChange={setNav}
        />
        <SegmentRow
          label={t("you.distanceUnit")}
          value={unit}
          options={[
            { value: "km" as const, label: t("you.unitKm") },
            { value: "mi" as const, label: t("you.unitMi") },
          ]}
          onChange={setUnit}
        />
        <SegmentRow
          label={t("you.theme")}
          value={themeMode}
          options={[
            { value: "auto" as ThemeMode, label: t("you.themeAuto") },
            { value: "light" as ThemeMode, label: t("you.themeLight") },
            { value: "dark" as ThemeMode, label: t("you.themeDark") },
          ]}
          onChange={setThemeMode}
          note={themeMode === "auto" ? t("you.themeAutoCopy") : undefined}
        />
        <SegmentRow
          label={t("you.language")}
          value={locale}
          options={[
            { value: "pt-BR" as Locale, label: "PT" },
            { value: "en" as Locale, label: "EN" },
          ]}
          onChange={setLocale}
        />
      </Group>

      {/* --- localizacao ---------------------------------------------------- */}
      <SectionTitle>{t("you.locationSection")}</SectionTitle>
      <Group>
        <div className="flex items-start gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold leading-snug">
              {t("you.locationOnlyActive")}
            </div>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-ink-50">
              {t("you.locationOnlyActiveCopy")}
            </p>
          </div>
          <Toggle checked={shareOnlyDuringTrips} onChange={setShareOnlyDuringTrips} />
        </div>
      </Group>

      {/* --- emergencia ----------------------------------------------------- */}
      <SectionTitle>{t("you.emergencyContact")}</SectionTitle>
      <Group>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2"
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-50">
            <Phone className="size-[17px]" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold">{t("you.notSet")}</div>
            <p className="mt-0.5 text-[13px] font-semibold text-ink-50">
              {t("you.emergencyContactCopy")}
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-ink-35" strokeWidth={2.5} />
        </button>
      </Group>

      <button
        type="button"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-card py-3 font-bold text-split-ink active:bg-split-soft"
      >
        <LogOut className="size-[18px]" strokeWidth={2.5} />
        {t("you.signOut")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-6 text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink-35">
      {children}
    </h2>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      {children}
    </div>
  );
}

/**
 * Escolha entre duas opcoes, resolvida na propria linha.
 *
 * Poderia ser uma linha que abre outra tela, mas sao duas opcoes: mandar a
 * pessoa para uma tela nova e voltar seria atrito por nada.
 */
function SegmentRow<T extends string>({
  label,
  value,
  options,
  onChange,
  note,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** so aparece quando o valor escolhido precisa de explicacao */
  note?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 text-[15px] font-bold">{label}</div>
      <div className="flex shrink-0 gap-0.5 rounded-pill bg-surface-2 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 rounded-pill px-3 text-[13px] font-bold transition-colors",
              value === o.value ? "bg-surface text-konvo-500 shadow-card" : "text-ink-50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      </div>
      {note && (
        <p className="mt-2 text-[13px] font-semibold leading-snug text-ink-50">{note}</p>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative mt-0.5 h-[30px] w-[50px] shrink-0 rounded-pill transition-colors",
        checked ? "bg-konvo-500" : "bg-surface-3",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-6 rounded-full bg-white shadow-card transition-all",
          checked ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}
