import os
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# ── Config from environment ───────────────────────────────────────────────────
COPERNICUS_USER = os.environ.get("COPERNICUS_USER", "")
COPERNICUS_PASS = os.environ.get("COPERNICUS_PASS", "")

# Your current Supabase project
SUPABASE_URL    = os.environ.get("SUPABASE_URL", "https://olrpwaoklzuownmibfim.supabase.co")
SUPABASE_KEY    = os.environ.get("SUPABASE_KEY", "")


# ── Health check ──────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "CarbonSetu dMRV Engine"})


# ── Main processing endpoint ──────────────────────────────────────────────────
@app.route("/process", methods=["POST"])
def process_farmer():
    farmer = request.json
    if not farmer or "id" not in farmer:
        return jsonify({"error": "Missing farmer payload"}), 400

    missing = [k for k in ("COPERNICUS_USER", "COPERNICUS_PASS", "SUPABASE_KEY")
               if not os.environ.get(k)]
    if missing:
        return jsonify({"error": f"Missing env vars: {', '.join(missing)}"}), 500

    # ── 1. Copernicus CDSE auth ───────────────────────────────────────────────
    try:
        token_resp = requests.post(
            "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
            data={
                "client_id":  "cdse-public",
                "username":   COPERNICUS_USER,
                "password":   COPERNICUS_PASS,
                "grant_type": "password",
            },
            timeout=15,
        )
        token_resp.raise_for_status()
        token = token_resp.json()["access_token"]
    except Exception as e:
        return jsonify({"error": f"Copernicus auth failed: {str(e)}"}), 502

    # ── 2. Search Sentinel-2 catalogue for latest scene at farm GPS ───────────
    lat, lon = farmer["latitude"], farmer["longitude"]
    search_url = (
        "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
        f"?$filter=Collection/Name eq 'SENTINEL-2' and "
        f"OData.CSC.Intersects(area=geography'SRID=4326;POINT({lon} {lat})')"
        f"&$orderby=ContentDate/Start desc&$top=1"
    )
    try:
        search_resp = requests.get(
            search_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        search_resp.raise_for_status()
        products = search_resp.json().get("value", [])
        scene_id = products[0].get("Id", "unknown") if products else "no-scene"
        print(f"[dMRV] Latest Sentinel-2 scene: {scene_id}")
    except Exception as e:
        print(f"[dMRV] Catalogue search warning: {e} — using fallback NDVI")
        scene_id = "fallback"

    # ── 3. NDVI calculation ───────────────────────────────────────────────────
    # Sentinel-2 Band 8 (NIR) and Band 4 (Red) reflectance values.
    # In production these are extracted from the actual scene download.
    # For demo/testnet: realistic values derived from typical Nagpur cotton/soybean.
    band8 = 0.45   # NIR reflectance
    band4 = 0.12   # Red reflectance
    ndvi  = (band8 - band4) / (band8 + band4)   # = 0.5789

    # ── 4. CO₂ calculation ────────────────────────────────────────────────────
    farm_area_hectares = farmer["farm_area_acres"] * 0.4047
    co2_tonnes = round(ndvi * farm_area_hectares * 10, 2)

    print(f"[dMRV] farmer={farmer['id']}  NDVI={ndvi:.4f}  CO₂={co2_tonnes}t")

    # ── 5. Write back to Supabase ─────────────────────────────────────────────
    try:
        patch_resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/farmers?id=eq.{farmer['id']}",
            headers={
                "apikey":        SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type":  "application/json",
                "Prefer":        "return=minimal",
            },
            json={
                "ndvi_score":   round(ndvi, 4),
                "co2_tonnes":   co2_tonnes,
                "token_status": "pending",
            },
            timeout=10,
        )
        patch_resp.raise_for_status()
    except Exception as e:
        return jsonify({"error": f"Supabase write failed: {str(e)}"}), 502

    return jsonify({
        "status":    "success",
        "farmer_id": farmer["id"],
        "ndvi":      round(ndvi, 4),
        "co2_tonnes": co2_tonnes,
        "scene_id":  scene_id,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
