# CarbonSetu dMRV 🌱

> Autonomous all-weather digital Measurement, Reporting & Verification (dMRV) pipeline for agricultural carbon credits — satellite-verified, blockchain-minted, UPI-settled.

Indian farmers absorb millions of tonnes of CO₂ every year through their crops and get nothing for it. Corporations need verified carbon credits for ESG reporting but can't trust opaque international markets. CarbonSetu connects them directly: GPS-located farms, Copernicus Sentinel-2 satellite NDVI scoring, ERC-20 tokens on Polygon, and instant UPI settlement.

---

## How It Works

```
Farmer registers on phone
    ↓ GPS captures exact farm location
Copernicus Sentinel-2 satellite calculates NDVI + CO₂
    ↓ Automated via n8n webhook pipeline
Admin mints ERC-20 token on Polygon blockchain
    ↓ Immutable, publicly verifiable on Amoy testnet
Buyer purchases via UPI (Decentro)
    ↓ 80% to farmer · 20% platform fee
Token burns permanently on-chain
    ↓
Buyer receives blockchain-verified impact certificate
```

---

## Features

- **Farmer Dashboard** — Register farm, view NDVI score, CO₂ absorption, and estimated earnings in real time
- **Satellite Pipeline** — Automated Copernicus API → NDVI calculation → Supabase update via n8n
- **Blockchain** — Solidity ERC-20 contract (`GEPCC`) on Polygon Amoy · Ethers.js v6 · MetaMask
- **Buyer Registry** — Browse verified carbon credits, filter by CO₂ / price, purchase via UPI
- **Admin Panel** — Mint tokens, auto-mint on NDVI update, view all farmers / tokens / transactions
- **Impact Certificate** — Printable, blockchain-verified certificate for ESG audit trail
- **Realtime Updates** — Supabase Postgres realtime subscriptions refresh the dashboard automatically

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · TanStack Router (SSR) · Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Realtime + Auth) |
| Blockchain | Solidity · Polygon Amoy Testnet · Ethers.js v6 |
| Automation | n8n · Copernicus Data Space API · Flask (satellite backend) |
| Payments | Decentro UPI |
| Deployment | Vite / TanStack Start · Render (Flask backend) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- MetaMask browser extension
- Supabase project
- Copernicus Data Space account (for satellite pipeline)

### Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd carbonsetu-dmrv-core

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CONTRACT_ADDRESS=your_deployed_contract_address
VITE_N8N_WEBHOOK_URL=your_n8n_webhook_url
VITE_DECENTRO_API_KEY=your_decentro_api_key
VITE_ADMIN_EMAIL=your_admin_email
VITE_APP_URL=http://localhost:5173
```

### Run

```bash
npm run dev
```

Open `http://localhost:5173`

---

## Smart Contract

**Contract:** `GEPCC` (Green Earth Platform Carbon Credit)  
**Network:** Polygon Amoy Testnet (Chain ID: 80002)  
**Address:** `0x049a443e7453F16C74229BF188B3A939e2753204`

Key functions:

```solidity
mintToken(address to, string farmerId, string gpsLat, string gpsLon,
          string ndviScore, string co2Tonnes, uint256 amount)
burnToken(uint256 tokenId)
getTokenDetails(uint256 tokenId)
```

---

## Satellite Pipeline (n8n)

```
Webhook trigger (farmer registered)
    → HTTP POST to Flask server (Render)
        → Copernicus auth token
        → Sentinel-2 image search by GPS bounding box
        → NDVI = (Band8 − Band4) / (Band8 + Band4)
        → CO₂ = NDVI × farm_area_hectares × 10
    → PATCH Supabase farmers table
        { ndvi_score, co2_tonnes }
    → Admin auto-mint triggered via realtime subscription
```

The n8n workflow definition lives at `n8n/kisan_credit_orchestration.json`.

---

## Project Structure

```
src/
├── lib/
│   ├── config.ts        # All env vars and constants
│   ├── db.ts            # All Supabase database operations
│   ├── api.ts           # External API calls (n8n, Decentro)
│   ├── blockchain.ts    # MetaMask + contract functions
│   ├── auth.ts          # Auth helpers and error formatting
│   ├── auth-guard.ts    # Route-level auth guards
│   └── nagpur.ts        # Taluka + village reference data
├── routes/
│   ├── index.tsx             # Landing page
│   ├── register.tsx          # Farmer registration form
│   ├── dashboard.tsx         # Farmer dashboard (realtime)
│   ├── registry.tsx          # Buyer marketplace
│   ├── admin.tsx             # Admin control panel
│   └── certificate.$id.tsx   # Impact certificate
├── agents/                   # TypeScript AI agent definitions
│   ├── CadastralSentinelAgent.ts
│   ├── SettlementTreasuryAgent.ts
│   └── SynthesisVerificationAgent.ts
└── components/
    ├── Navbar.tsx
    └── SiteFooter.tsx
contracts/
└── KisanCredit.sol           # Solidity ERC-20 contract
n8n/
└── kisan_credit_orchestration.json  # n8n automation workflow
```

---

## License

MIT
