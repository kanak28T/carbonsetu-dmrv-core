# Audit Report — carbonsetu-dmrv-core

**Date:** 2026-10-16  
**Scope:** Image integrity, dashboard functionality, project health, README cleanup

---

## Summary

The project is in good overall shape. No locally-hosted image files are broken because all images are served from the Unsplash CDN — there is no `/public` or `src/assets` directory at all. The dashboard logic is sound and the route tree is complete. There are **four issues to fix**:

1. A personal email is hardcoded as a fallback in `config.ts`.
2. A personal email is hardcoded as a fallback in `admin.tsx` (farmer wallet address).
3. The certificate page uses the wrong Polygonscan URL (mainnet instead of Amoy testnet).
4. The README contains personal names, personal GitHub URL, and stale project branding.

---

## 1. Broken / Missing Images

**Finding: None broken.**

All images in the project are sourced from the Unsplash CDN as absolute HTTPS URLs defined in `src/lib/images.ts`. There is no `/public` directory and no `src/assets` directory — confirmed by filesystem check. No component uses a relative path to a local image file.

The eight CDN URLs defined in `IMAGES` and `FARM_CARD_IMAGES`:

| Key | URL (truncated) |
|-----|-----------------|
| `heroFarm` | `photo-1625246333195-78d9c38ad449` |
| `farmerField` | `photo-1574943325803-72727bbf0890` |
| `farmerPortrait` | `photo-1589923188900-85dae523342b` |
| `buyerOffice` | `photo-1521791136064-7986c2920216` |
| `greenCrops` | `photo-1500382017468-9049fed747be` |
| `ruralLandscape` | `photo-1586771100165-bfe046b220e0` |
| `handsSoil` | `photo-1464226184556-4ce0891c5f72` |
| `buyerForest` | `photo-1448375240586-882707db888b` |
| `sunriseFarm` | `photo-1416879595882-3373a0480b5b` |

All URLs follow the standard Unsplash CDN pattern and are referenced consistently. No `<img src=...>` tags in the codebase point to local files.

**If images appear broken in the browser**, the cause is a network/CDN issue (Unsplash outage, ad blocker, or missing internet connection) — not missing files.

---

## 2. Dashboard Functionality Audit

### 2a. `src/routes/dashboard.tsx`

**Status: Functionally correct — one minor note.**

- All imports resolve: `@tanstack/react-router`, `lucide-react`, `@/integrations/supabase/client`, `@/hooks/useAuth`, `@/lib/auth-guard`, `@/lib/config` — all files confirmed to exist.
- Auth guard (`requireAuth`) is called in `beforeLoad` correctly.
- Supabase query fetches all columns from `farmers` table and orders by `ndvi_score`.
- Realtime subscription on `postgres_changes` (UPDATE, farmers table) correctly refreshes data.
- Field names (`ndvi_score`, `co2_tonnes`, `token_status`, `polygonscan_hash`, etc.) all match the DB type definitions in `src/integrations/supabase/types.ts`.
- Earnings calculation: `co2_tonnes * CONFIG.pricing.pricePerTonneCO2 * CONFIG.pricing.farmerPayoutPercent` — this is correct (₹3000 × 0.80 = ₹2400/tonne to farmer). However the card label says "80% of token value" which matches the math.
- Blockchain explorer link: `${CONFIG.blockchain.explorerUrl}/tx/${f.polygonscan_hash}` — `explorerUrl` is `https://amoy.polygonscan.com` ✅

**Note:** Dashboard fetches **all farmers** regardless of the logged-in user, not just the current user's farms. This appears to be intentional (farmers see all registered farms), but worth confirming with the business requirement.

### 2b. `src/lib/db.ts`

**Status: Correct — one logic note.**

- `updateFarmerNDVI` sets `token_status: "minted"` when NDVI is calculated — this is actually premature (the token isn't minted on-chain yet at this step; it is just satellite-verified). The `dashboard.tsx` status bar handles this gracefully with the `hasNDVI && !isMinted` branch showing "Satellite verified — Awaiting token mint", so it's not a user-visible bug, but the DB value is semantically wrong.
- `updateFarmerMintHash` ignores the `tokenIdOnchain` parameter — it delegates to `updateFarmerTokenHash` which only writes `polygonscan_hash`. The `token_id_onchain` column is only on `carbon_tokens`, not `farmers`, so this is architecturally correct (the comment confirms it), but confusing that the parameter is accepted and then voided.

### 2c. `src/lib/config.ts`

**Issue: Hardcoded personal email as fallback (line 38).**

```ts
adminEmail: (import.meta.env.VITE_ADMIN_EMAIL ?? "priyanshupatil336@gmail.com") as string,
```

The fallback value is a personal Gmail address. If `VITE_ADMIN_EMAIL` is absent from `.env`, this email becomes the admin. It should be `""` or a placeholder, with the application throwing/warning if the env var is not set.

### 2d. `src/integrations/supabase/client.ts`

**Status: Correct.**

- Validates both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before creating the client.
- Falls back to `VITE_SUPABASE_PUBLISHABLE_KEY` for the anon key (legacy alias) — harmless.
- Uses `detectSessionInUrl: false` + `flowType: "pkce"` — consistent with manual code exchange in `auth.callback.tsx`.

### 2e. `src/hooks/useAuth.ts`

**Status: Correct.**

- Subscribes to `onAuthStateChange` and also calls `getSession()` on mount to cover SSR/initial load.
- Returns `signOut` which calls `supabase.auth.signOut()`.
- No issues found.

### 2f. `src/lib/auth-guard.ts`

**Status: Correct — one dependency note.**

- `requireAuth` / `requireAdmin` / `redirectIfAuthenticated` all guard against SSR correctly.
- `requireAdmin` compares `userEmail !== CONFIG.app.adminEmail` — this will silently fail to protect the admin route if `VITE_ADMIN_EMAIL` is not set (falls back to hardcoded personal email — see 2c above).

### 2g. `src/lib/auth.ts`

**Status: Correct.**

- `getAuthRedirectUrl` normalizes `127.0.0.1 → localhost` — correct for Supabase OAuth.
- `formatAuthError` covers all common Supabase error messages.

---

## 3. General Project Health

### 3a. Route completeness

All routes imported in `src/routeTree.gen.ts` have corresponding source files in `src/routes/`:

| Route | File | Exists |
|-------|------|--------|
| `/` | `routes/index.tsx` | ✅ |
| `/about` | `routes/about.tsx` | ✅ |
| `/admin` | `routes/admin.tsx` | ✅ |
| `/dashboard` | `routes/dashboard.tsx` | ✅ |
| `/forgot-password` | `routes/forgot-password.tsx` | ✅ |
| `/login` | `routes/login.tsx` | ✅ |
| `/register` | `routes/register.tsx` | ✅ |
| `/registry` | `routes/registry.tsx` | ✅ |
| `/reset-password` | `routes/reset-password.tsx` | ✅ |
| `/signup` | `routes/signup.tsx` | ✅ |
| `/auth/callback` | `routes/auth.callback.tsx` | ✅ |
| `/certificate/$id` | `routes/certificate.$id.tsx` | ✅ |

**No missing route files.**

### 3b. `src/router.tsx`

Uses `routeTree` from the auto-generated `routeTree.gen.ts`. No issues.

### 3c. `src/routes/__root.tsx`

Imports `Navbar` from `@/components/Navbar` ✅, `styles.css?url` ✅. `SiteFooter` is imported per-page (not in root). No missing imports.

### 3d. `src/components/Navbar.tsx`

- All imports resolve: `useAuth`, `connectWallet` from `@/lib/blockchain`, `CONFIG` from `@/lib/config`.
- Links: `/dashboard`, `/login`, `/registry`, `/about`, `/admin`, `/register` — all routes exist ✅.
- Admin link conditional on `user?.email === CONFIG.app.adminEmail` — works correctly, though dependent on the hardcoded fallback issue noted in 2c.

### 3e. Issue in `src/routes/certificate.$id.tsx`

**Bug: Wrong Polygonscan domain used in `HashLink`.**

The `HashLink` component hardcodes the mainnet URL:

```tsx
href={`https://polygonscan.com/tx/${hash}`}
```

But the project is on **Polygon Amoy testnet**. The correct URL is `https://amoy.polygonscan.com/tx/...`.

Compare to how `dashboard.tsx` and `admin.tsx` correctly use `CONFIG.blockchain.explorerUrl` (`https://amoy.polygonscan.com`). The certificate page bypasses the config constant and points to the wrong network — clicking the link will show "Transaction Not Found" on the Amoy testnet.

### 3f. Issue in `src/routes/admin.tsx`

**Hardcoded farmer wallet address (lines 78 and 137):**

```ts
"0x573874dAbAe68fbE01b0679585dEd85D3C36Bf2A",
```

This address is passed as the `farmerAddress` argument to `mintTokens()` — the on-chain recipient of minted tokens. It is the same hardcoded address in both `autoMint()` and `handleMint()`. This should come from the farmer's linked wallet address (stored in DB or provided in the UI), not from a hardcoded constant. As a testnet demo this still works, but is a significant issue for production.

---

## 4. README Audit

### 4a. Personal names to remove

The README contains:

```markdown
## Team
- **Priyanshu Patil** : Frontend · Blockchain integration · Supabase
- **Kanak Tembhure** : Satellite pipeline · Copernicus API · NDVI engine · Flask backend
```

The entire **Team** section must be removed per user instructions.

### 4b. Personal GitHub URL to remove

```markdown
git clone https://github.com/priyanshuu-06/kisanCredit.git
```

This points to a personal GitHub account. The clone URL should be replaced with a generic placeholder or the actual project repository URL.

### 4c. Project branding mismatch

The repository is named `carbonsetu-dmrv-core` and `__root.tsx` uses "CarbonSetu | Autonomous Agricultural dMRV Platform" as the page title. But the README is written as "किसान Credit" — an older product name. The README needs to be rewritten to reflect the current branding: **CarbonSetu dMRV**.

### 4d. Outdated sections

- The README describes **Make.com** as the automation pipeline (`Make.com pipeline`), but the codebase uses **n8n** (`src/lib/api.ts` calls `triggerN8NWebhook`, `n8n/kisan_credit_orchestration.json` exists). Make.com is mentioned nowhere in source code.
- The Flask server URL `https://kisan-credit-pipeline.onrender.com` is a personal project URL; should be removed or replaced with a placeholder.
- The docs section references `docs/Team Aether_KisanCredit.pdf` — contains team name ("Team Aether") and old project name.
- The git clone URL references the old project name `kisanCredit`.
- The project structure in README is correct and matches what exists in `src/`.

### 4e. What the project actually does (for accurate README)

Based on the codebase:

- **Frontend**: React 19 + TanStack Router (SSR-enabled via `@tanstack/react-start`) + Tailwind CSS v4
- **Database**: Supabase (PostgreSQL + Realtime + Auth with Google OAuth + email/password)
- **Blockchain**: Solidity ERC-20 contract (`GEPCC`) on Polygon Amoy Testnet; Ethers.js v6; MetaMask wallet
- **Automation**: n8n webhook pipeline (not Make.com) for Copernicus satellite NDVI calculation
- **Payments**: Decentro UPI (currently mock/not live)
- **Deployment**: Vite + TanStack Start (SSR); backend Flask on Render for satellite pipeline
- **Purpose**: Farmers in Nagpur district register farms → satellite NDVI score calculated → carbon credit token minted on Polygon → buyers purchase tokens via UPI → 80% payout to farmer → token burned (retired) → certificate issued

---

## Conclusions & Recommendations

### Must fix

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `src/lib/config.ts` line 38 | Hardcoded personal Gmail as admin email fallback | Change fallback to `""` and throw/warn if env var is missing |
| 2 | `src/routes/certificate.$id.tsx` `HashLink` | Wrong Polygonscan URL (mainnet not testnet) | Replace `polygonscan.com` with `${CONFIG.blockchain.explorerUrl}` |
| 3 | `README.md` | Team names, personal GitHub URL, Make.com vs n8n, old branding | Rewrite README (see section 4) |

### Should fix

| # | File | Issue | Fix |
|---|------|-------|-----|
| 4 | `src/routes/admin.tsx` lines 78 & 137 | Hardcoded farmer wallet address `0x5738…` | Move to `CONFIG` or derive from farmer's linked wallet |
| 5 | `src/lib/db.ts` `updateFarmerNDVI` | Sets `token_status: "minted"` before on-chain mint | Change to `"verified"` (a new status) or `"pending"` — the dashboard already handles the intermediate state |

### No action needed

- All images load from Unsplash CDN; no local image files are missing.
- All route files exist.
- Dashboard data flow, Supabase queries, realtime subscriptions, and auth guard logic are all correct.
- `useAuth`, `auth.ts`, `auth-guard.ts`, and `supabase/client.ts` are all correctly implemented.
