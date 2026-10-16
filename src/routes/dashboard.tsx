import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Leaf, MapPin, Clock, CheckCircle2, Loader2,
  ExternalLink, Sprout, AlertCircle, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { requireAuth } from "@/lib/auth-guard";
import { CONFIG } from "@/lib/config";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => requireAuth(),
  component: FarmerDashboard,
});

type Farmer = {
  id: string;
  name: string;
  mobile: string;
  taluka: string;
  village: string;
  gat_number: string;
  latitude: number;
  longitude: number;
  farm_area_acres: number;
  ndvi_score: number | null;
  co2_tonnes: number | null;
  token_status: string;
  polygonscan_hash: string | null;
  created_at: string;
};

function FarmerDashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    try {
      const { data, error: err } = await supabase
        .from("farmers")
        .select("*")
        .order("ndvi_score", { ascending: false, nullsFirst: false });
      if (err) throw err;
      setFarmers((data ?? []) as Farmer[]);
    } catch (e: any) {
      setError(e?.message ?? t("dash_loadFail"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel("dashboard-farmers")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "farmers" }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("dash_title")}</h1>
          <p className="text-sm text-foreground/60 mt-1">{t("dash_subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-primary transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {t("dash_refresh")}
          </button>
          <Link
            to="/register"
            className="kc-btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5"
          >
            <Sprout className="w-4 h-4" />
            {t("dash_newFarm")}
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {farmers.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-border">
          <Sprout className="w-14 h-14 mx-auto text-primary/30 mb-4" />
          <h2 className="text-xl font-bold text-foreground">{t("dash_noFarm")}</h2>
          <p className="text-foreground/60 mt-2 mb-6">{t("dash_noFarmMsg")}</p>
          <Link to="/register" className="kc-btn-primary inline-flex items-center gap-2 px-6 py-3">
            <Sprout className="w-5 h-5" />
            {t("dash_registerBtn")}
          </Link>
        </div>
      )}

      {/* Summary strip */}
      {farmers.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{farmers.length}</p>
            <p className="text-xs text-foreground/50 mt-1">{t("dash_totalFarms")}</p>
          </div>
          <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {farmers.filter(f => f.ndvi_score !== null).length}
            </p>
            <p className="text-xs text-primary/70 mt-1">{t("dash_verified")} ✅</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">
              {farmers.filter(f => f.ndvi_score === null).length}
            </p>
            <p className="text-xs text-amber-600 mt-1">{t("dash_processing")} ⏳</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {farmers.map((f) => (
          <FarmCard key={f.id} farmer={f} />
        ))}
      </div>
    </div>
  );
}

function FarmCard({ farmer: f }: { farmer: Farmer }) {
  const { t } = useLang();
  const hasNDVI   = f.ndvi_score !== null && f.co2_tonnes !== null;
  const isMinted  = f.token_status === "minted";
  const isBurned  = f.token_status === "burned";

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Status bar */}
      <div className={`px-6 py-3 flex items-center gap-2 text-sm font-semibold ${
        isMinted ? "bg-primary/10 text-primary" :
        isBurned ? "bg-secondary/10 text-secondary" :
        hasNDVI  ? "bg-blue-50 text-blue-700" :
        "bg-amber-50 text-amber-700"
      }`}>
        {isMinted && <CheckCircle2 className="w-4 h-4" />}
        {isBurned && <Leaf className="w-4 h-4" />}
        {!isMinted && !isBurned && <Clock className="w-4 h-4" />}

        {isMinted && t("dash_status_minted")}
        {isBurned && t("dash_status_burned")}
        {!isMinted && !isBurned && hasNDVI  && t("dash_status_verified")}
        {!isMinted && !isBurned && !hasNDVI && t("dash_status_pending")}
      </div>

      <div className="p-6">
        {/* Farm name + location */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">{f.name}</h2>
            <div className="flex items-center gap-1.5 text-foreground/60 text-sm mt-1">
              <MapPin className="w-4 h-4 shrink-0" />
              {f.village}, {f.taluka}, Nagpur
            </div>
          </div>
          <span className="text-xs text-foreground/40 whitespace-nowrap">
            {new Date(f.created_at).toLocaleDateString("en-IN")}
          </span>
        </div>

        {/* Farm details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <InfoBox label={t("dash_gatNo")}  value={f.gat_number} />
          <InfoBox label={t("dash_area")}   value={`${f.farm_area_acres} acres`} />
          <InfoBox label={t("dash_gps")}    value={`${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}`} mono />
          <InfoBox label={t("dash_mobile")} value={f.mobile} />
        </div>

        {/* NDVI + CO2 results */}
        {!hasNDVI ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">{t("dash_pending_title")}</p>
                <p className="text-sm text-amber-700 mt-1">{t("dash_pending_body")}</p>
                <p className="text-xs text-amber-600 mt-2">{t("dash_pending_note")}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* NDVI Score */}
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                {t("dash_ndvi")}
              </p>
              <p className="text-3xl font-bold text-green-700">
                {f.ndvi_score?.toFixed(2) ?? "—"}
              </p>
              <p className="text-xs text-green-600 mt-1">{t("dash_satellite")}</p>
              <div className="mt-2 h-2 rounded-full bg-green-200 overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${((f.ndvi_score ?? 0) * 100).toFixed(0)}%` }}
                />
              </div>
            </div>

            {/* CO2 Tonnes */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                {t("dash_co2")}
              </p>
              <p className="text-3xl font-bold text-primary">
                {f.co2_tonnes?.toFixed(2) ?? "—"}
              </p>
              <p className="text-xs text-primary/70 mt-1">{t("dash_tpy")}</p>
            </div>

            {/* Estimated earnings */}
            <div className="rounded-xl bg-accent/10 border border-accent/30 p-4 text-center">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                {t("dash_earnings")}
              </p>
              <p className="text-3xl font-bold text-amber-700">
                ₹ {f.co2_tonnes
                  ? Math.round(f.co2_tonnes * CONFIG.pricing.pricePerTonneCO2 * CONFIG.pricing.farmerPayoutPercent).toLocaleString("en-IN")
                  : "—"}
              </p>
              <p className="text-xs text-amber-600 mt-1">{t("dash_earnings80")}</p>
            </div>
          </div>
        )}

        {/* Blockchain link */}
        {f.polygonscan_hash && (
          <div className="mt-4 pt-4 border-t border-border">
            <a
              href={`${CONFIG.blockchain.explorerUrl}/tx/${f.polygonscan_hash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-secondary font-semibold hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              {t("dash_polygonscan")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBox({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs text-foreground/50 font-medium mb-0.5">{label}</p>
      <p className={`font-semibold text-foreground text-sm ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </p>
    </div>
  );
}
