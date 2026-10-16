import os
import json
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
    # ── Bulletproof body parsing ──────────────────────────────────────────────
    # Try Flask's JSON parser first (handles Content-Type: application/json)
    data = request.get_json(force=True, silent=True)

    # Fallback: if get_json returned None/non-dict, parse raw bytes manually
    if not isinstance(data, dict):
        try:
            data = json.loads(request.get_data(as_text=True))
        except Exception:
            data = {}

    # n8n sometimes wraps payload as {"farmer": {...}, "access_token": "..."}
    # or sends the farmer object directly — handle both shapes
    farmer = (
        data.get("farmer")          # n8n wrapped shape
        or data.get("body", {}).get("farmer")  # double-wrapped
        or data                      # flat shape (direct from api.ts)
    )

    # Normalise field names (id vs farmer_id, farm_area_acres vs land_area)
    farmer_id      = farmer.get("id") or farmer.get("farmer_id")
    farm_area      = farmer.get("farm_area_acres") or farmer.get("land_area") or 0
    lat            = farmer.get("latitude")  or farmer.get("lat")
    lon            = farmer.get("longitude") or farmer.get("lon")

    if not farmer_id or not lat or not lon:
        return jsonify({
            "error":    "Missing required farmer fields (id, latitude, longitude)",
            "received": str(request.get_data())[:300],
        }), 400

    missing = [k for k in ("COPERNICUS_USER", "COPERNICUS_PASS", "SUPABASE_KEY")
               if not os.environ.get(k)]
    if missing:
        return jsonify({"error": f"Missing env vars: {', '.join(missing)}"}), 500

    # ── 1. Copernicus token — use n8n's pre-fetched token if available ────────
    # n8n Node 03 already fetched the token and sends it in body + header.
    # Only do a fresh login if neither is present (direct curl / fallback calls).
    token = (
        data.get("access_token")                       # body: {"access_token": "..."}
        or request.headers.get("X-Copernicus-Token")   # header: X-Copernicus-Token
    )

    if not token:
        try:
            token_resp = requests.post(
                "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
                data={                          # MUST be form-encoded (data=), NOT json=
                    "client_id":  "cdse-public",
                    "username":   COPERNICUS_USER,
                    "password":   COPERNICUS_PASS,
                    "grant_type": "password",
                },
                timeout=15,
            )
            if token_resp.status_code != 200:
                return jsonify({"error": f"Copernicus auth failed: {token_resp.text}"}), 502
            token = token_resp.json()["access_token"]
        except Exception as e:
            return jsonify({"error": f"Copernicus auth failed: {str(e)}"}), 502

    # ── 2. Search Sentinel-2 catalogue for latest scene at farm GPS ───────────
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
    farm_area_hectares = farm_area * 0.4047
    co2_tonnes = round(ndvi * farm_area_hectares * 10, 2)

    print(f"[dMRV] farmer={farmer_id}  NDVI={ndvi:.4f}  CO₂={co2_tonnes}t")

    # ── 5. Write back to Supabase ─────────────────────────────────────────────
    try:
        patch_resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/farmers?id=eq.{farmer_id}",
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
        "status":     "success",
        "farmer_id":  farmer_id,
        "ndvi":       round(ndvi, 4),
        "co2_tonnes": co2_tonnes,
        "scene_id":   scene_id,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
