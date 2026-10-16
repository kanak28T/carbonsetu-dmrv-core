import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { insertFarmer, type FarmerInput } from "@/lib/db";
import { triggerN8NWebhook } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { isNagpurTaluka, NAGPUR_TALUKAS, getVillagesForTaluka } from "@/lib/nagpur";
import { requireAuth } from "@/lib/auth-guard";
import { IMAGES } from "@/lib/images";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/register")({
  beforeLoad: () => requireAuth(),
  component: RegisterPage,
});

const emptyForm: FarmerInput = {
  name: "",
  mobile: "",
  taluka: "",
  village: "",
  gat_number: "",
  latitude: 0,
  longitude: 0,
  farm_area_acres: 0,
};

function RegisterPage() {
  const { user, loading } = useAuth();
  const { t } = useLang();
  const [form, setForm] = useState<FarmerInput>(emptyForm);
  const [gpsCaptured, setGpsCaptured] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FarmerInput>(k: K, v: FarmerInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleTalukaChange(taluka: string) {
    setForm((f) => ({ ...f, taluka, village: "" }));
  }

  const villages = form.taluka ? getVillagesForTaluka(form.taluka) : [];

  function captureGPS() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(t("gps_denied"));
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("latitude", Number(pos.coords.latitude.toFixed(6)));
        update("longitude", Number(pos.coords.longitude.toFixed(6)));
        setGpsCaptured(true);
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1)      setError(t("gps_denied"));
        else if (err.code === 2) setError(t("gps_unavail"));
        else if (err.code === 3) setError(t("gps_timeout"));
        else                     setError(`Location error (code ${err.code}): ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim())                           { setError(t("val_name"));    return; }
    if (!form.mobile || !/^\d{10}$/.test(form.mobile)) { setError(t("val_mobile")); return; }
    if (!form.taluka || !isNagpurTaluka(form.taluka))  { setError(t("val_taluka")); return; }
    if (!form.village)                               { setError(t("val_village")); return; }
    if (!form.gat_number.trim())                     { setError(t("val_gat"));     return; }
    if (!form.latitude || !form.longitude)           { setError(t("val_gps"));     return; }
    if (!form.farm_area_acres || form.farm_area_acres <= 0) { setError(t("val_area")); return; }

    setSubmitting(true);
    try {
      const farmer = await insertFarmer(form);
      triggerN8NWebhook({ ...farmer }).catch(() => undefined);
      setSuccess(true);
      setForm(emptyForm);
      setGpsCaptured(false);
      setTimeout(() => setSuccess(false), 8000);
    } catch (err: any) {
      setError(err?.message ?? t("val_submitFail"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-65px)] grid lg:grid-cols-2">
      {/* Left hero panel */}
      <aside className="relative min-h-[280px] lg:min-h-full">
        <img
          src={IMAGES.ruralLandscape}
          alt="Farm landscape in Maharashtra"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-black/75 to-black/30" />
        <div className="relative p-8 lg:p-12 flex flex-col justify-end h-full text-white max-w-lg">
          <p className="text-accent font-semibold text-sm uppercase tracking-wide">{t("reg_heroTag")}</p>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold leading-tight">
            {t("reg_heroTitle")}
          </h2>
          <ul className="mt-6 space-y-3 text-white/90 text-base">
            {([
              t("reg_bullet1"),
              t("reg_bullet2"),
              t("reg_bullet3"),
            ] as string[]).map((b) => (
              <li key={b} className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                {b}
              </li>
            ))}
          </ul>
          <img
            src={IMAGES.farmerPortrait}
            alt=""
            className="mt-8 w-20 h-20 rounded-full object-cover border-2 border-white/40 hidden lg:block"
            aria-hidden
          />
        </div>
      </aside>

      {/* Right form panel */}
      <section className="bg-white p-6 md:p-10 lg:p-12 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("reg_title")}</h1>
          <p className="mt-1 text-foreground/60">{t("reg_subtitle")}</p>

          {success && (
            <div className="mt-6 p-5 rounded-xl border-2 border-primary bg-primary/5">
              <div className="flex gap-3">
                <CheckCircle2 className="w-8 h-8 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-primary text-lg">{t("reg_success")}</p>
                  <p className="text-foreground/75 mt-1">{t("reg_successMsg")}</p>
                  <Link
                    to="/dashboard"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    {t("reg_viewFarm")} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">

            {/* Name */}
            <BigField label={t("reg_name")}>
              <input
                className="kc-input-lg"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="उदा. रामेश्वर पाटील"
              />
            </BigField>

            {/* Mobile */}
            <BigField label={t("reg_mobile")}>
              <input
                className="kc-input-lg"
                value={form.mobile}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  update("mobile", digits);
                }}
                placeholder="9876543210"
                inputMode="numeric"
                maxLength={10}
              />
              {form.mobile.length > 0 && form.mobile.length < 10 && (
                <p className="mt-1 text-xs text-destructive">
                  {10 - form.mobile.length} {t("reg_digitsLeft")}
                </p>
              )}
              {form.mobile.length === 10 && (
                <p className="mt-1 text-xs text-primary font-medium">✓ 10</p>
              )}
            </BigField>

            {/* Taluka → Village */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <BigField label={t("reg_taluka")}>
                <select
                  className="kc-input-lg w-full"
                  value={form.taluka}
                  onChange={(e) => handleTalukaChange(e.target.value)}
                  required
                >
                  <option value="" disabled>{t("reg_selectTaluka")}</option>
                  {NAGPUR_TALUKAS.map((t_) => (
                    <option key={t_} value={t_}>{t_}</option>
                  ))}
                </select>
              </BigField>

              <BigField label={t("reg_village")}>
                {villages.length > 0 ? (
                  <select
                    className="kc-input-lg w-full"
                    value={form.village}
                    onChange={(e) => update("village", e.target.value)}
                    required
                  >
                    <option value="" disabled>{t("reg_selectVillage")}</option>
                    {villages.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <select className="kc-input-lg w-full" disabled>
                    <option>{t("reg_selectTalukaFirst")}</option>
                  </select>
                )}
              </BigField>
            </div>

            {/* Gat Number */}
            <BigField label={t("reg_gatNo")}>
              <input
                className="kc-input-lg"
                value={form.gat_number}
                onChange={(e) => update("gat_number", e.target.value)}
                placeholder="142/2"
              />
            </BigField>

            {/* Farm area */}
            <BigField label={t("reg_area")}>
              <input
                className="kc-input-lg"
                type="number"
                step="0.01"
                min="0"
                value={form.farm_area_acres || ""}
                onChange={(e) => update("farm_area_acres", parseFloat(e.target.value) || 0)}
                placeholder="2.5"
              />
            </BigField>

            {/* GPS */}
            <div className="space-y-2">
              {!gpsCaptured && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-amber-800">📍 {t("reg_gpsWarning")}</p>
                    <p className="text-amber-700 mt-0.5">{t("reg_gpsNote")}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={captureGPS}
                disabled={gpsLoading}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl text-lg font-bold border-2 transition ${
                  gpsCaptured
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-secondary bg-secondary text-white"
                } disabled:opacity-60`}
              >
                {gpsLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <MapPin className="w-6 h-6" />
                )}
                {gpsLoading
                  ? t("reg_gpsGetting")
                  : gpsCaptured
                    ? `✓ ${t("reg_gpsGot")} (${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)})`
                    : t("reg_gpsBtn")}
              </button>

              {gpsCaptured && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-medium">
                    {t("reg_gpsSaved")}: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setGpsCaptured(false); update("latitude", 0); update("longitude", 0); }}
                    className="ml-auto text-xs text-foreground/40 hover:text-destructive underline"
                  >
                    {t("reg_gpsRetake")}
                  </button>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full kc-btn-primary py-4 text-xl rounded-xl inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-6 h-6 animate-spin" />}
              {submitting ? t("reg_submitting") : t("reg_submit")}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function BigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-base font-bold text-foreground mb-2">{label}</label>
      {children}
    </div>
  );
}
