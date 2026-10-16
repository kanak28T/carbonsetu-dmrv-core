/**
 * Lightweight i18n — English / Hindi / Marathi
 * No external deps. Uses React context + localStorage persistence.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "en" | "hi" | "mr";

// ── Translations ──────────────────────────────────────────────────────────────

export const translations = {
  // ── Navbar ────────────────────────────────────────────────────────────────
  nav_myFarm:    { en: "My Farm",       hi: "मेरी खेती",      mr: "माझे शेत"        },
  nav_forFarmers:{ en: "For farmers",   hi: "किसानों के लिए",  mr: "शेतकऱ्यांसाठी"  },
  nav_buyCredits:{ en: "Buy credits",   hi: "क्रेडिट खरीदें",  mr: "क्रेडिट खरेदी"  },
  nav_about:     { en: "About",         hi: "हमारे बारे में",  mr: "आमच्याबद्दल"    },
  nav_admin:     { en: "Admin",         hi: "एडमिन",          mr: "अ‍ॅडमिन"         },
  nav_connect:   { en: "Connect Wallet",hi: "वॉलेट जोड़ें",   mr: "वॉलेट जोडा"     },
  nav_connecting:{ en: "Connecting…",   hi: "जुड़ रहा है…",    mr: "जोडत आहे…"      },
  nav_login:     { en: "Farmer login",  hi: "किसान लॉगिन",    mr: "शेतकरी लॉगिन"   },

  // ── Register page ─────────────────────────────────────────────────────────
  reg_heroTag:   { en: "Farmer Registration", hi: "किसान पंजीकरण", mr: "शेतकरी नोंदणी" },
  reg_heroTitle: { en: "Register your farm",  hi: "अपनी खेती नोंदणी करें", mr: "तुमच्या शेताची नोंदणी करा" },
  reg_bullet1:   { en: "Takes only 2–3 minutes",       hi: "केवल 2–3 मिनट लगते हैं",      mr: "फक्त २–३ मिनिटे लागतात"    },
  reg_bullet2:   { en: "Only Nagpur district farmers", hi: "केवल नागपुर जिले के किसान",    mr: "नागपूर जिल्ह्यातील शेतकरीच" },
  reg_bullet3:   { en: "90% directly to your account", hi: "90% सीधे आपके खाते में",      mr: "90% रक्कम थेट तुमच्या खात्यात" },
  reg_title:     { en: "Farm details",         hi: "खेत की जानकारी",  mr: "शेताची माहिती"   },
  reg_subtitle:  { en: "Fill all details correctly", hi: "सभी जानकारी सही भरें", mr: "सर्व माहिती खरी आणि पूर्ण भरा" },
  reg_name:      { en: "Full name",            hi: "पूरा नाम",        mr: "पूर्ण नाव"       },
  reg_mobile:    { en: "Mobile number",        hi: "मोबाइल नंबर",    mr: "मोबाईल नंबर"    },
  reg_taluka:    { en: "Taluka (Nagpur)",       hi: "तालुका (नागपुर)", mr: "तालुका (नागपूर)" },
  reg_village:   { en: "Village",              hi: "गाँव",            mr: "गाव"             },
  reg_gatNo:     { en: "Gat number",           hi: "गाट नंबर",        mr: "गट नंबर"         },
  reg_area:      { en: "Farm area (acres)",    hi: "खेत क्षेत्र (एकड़)", mr: "शेताचे क्षेत्र (एकर)" },
  reg_selectTaluka: { en: "Select taluka", hi: "तालुका चुनें", mr: "तालुका निवडा" },
  reg_selectVillage:{ en: "Select village",hi: "गाँव चुनें",   mr: "गाव निवडा"   },
  reg_selectTalukaFirst:{ en: "Select taluka first", hi: "पहले तालुका चुनें", mr: "आधी तालुका निवडा" },
  reg_digitsLeft:{ en: "digits remaining", hi: "अंक बाकी हैं", mr: "अंक बाकी आहेत" },
  reg_gpsWarning:{ en: "Go to your farm and tap the button below",
                   hi: "अपनी खेती में जाकर नीचे का बटन दबाएं",
                   mr: "शेतात जाऊन हे बटण दाबा" },
  reg_gpsNote:   { en: "Capture GPS from your farm — not from home. Exact location is required for satellite verification.",
                   hi: "GPS लोकेशन खेत से लें — घर से नहीं। सैटेलाइट वेरिफिकेशन के लिए सटीक जगह जरूरी है।",
                   mr: "GPS location शेतातूनच घ्या — घरातून नाही. Satellite verification साठी exact farm location आवश्यक आहे." },
  reg_gpsBtn:    { en: "Capture farm GPS",     hi: "खेत का GPS लें",  mr: "शेताचे location घ्या (GPS)" },
  reg_gpsGetting:{ en: "Getting location…",    hi: "लोकेशन मिल रहा है…", mr: "Location मिळवत आहे…" },
  reg_gpsGot:    { en: "Location captured",    hi: "लोकेशन मिला",    mr: "Location मिळाले"  },
  reg_gpsRetake: { en: "retake",               hi: "फिर से लें",     mr: "retake"           },
  reg_gpsSaved:  { en: "Farm location saved",  hi: "खेत की लोकेशन सेव हुई", mr: "Farm location saved" },
  reg_submit:    { en: "Register farm",        hi: "खेत नोंदणी करें", mr: "नोंदणी करा"      },
  reg_submitting:{ en: "Registering…",         hi: "नोंदणी हो रही है…", mr: "नोंदणी होत आहे…" },
  reg_success:   { en: "Registration done!",   hi: "पंजीकरण हो गया!", mr: "नोंदणी झाली!"    },
  reg_successMsg:{ en: "Our team will verify your farm using satellite data. NDVI score and CO₂ tonnes will appear on your dashboard once calculated.",
                   hi: "हमारी टीम satellite data से आपकी खेती की जांच करेगी। NDVI score और CO₂ tonnes calculate होने पर dashboard पर दिखेगा।",
                   mr: "आमची टीम तुमच्या शेताची पडताळणी satellite data वापरून करेल. NDVI score आणि CO₂ tonnes calculate होताच तुम्हाला dashboard वर दिसेल." },
  reg_viewFarm:  { en: "View my farm dashboard", hi: "मेरा फार्म डैशबोर्ड देखें", mr: "माझे शेत पहा" },

  // ── Validation messages ───────────────────────────────────────────────────
  val_name:      { en: "Please enter full name.",              hi: "कृपया पूरा नाम भरें।",           mr: "कृपया पूर्ण नाव भरा."          },
  val_mobile:    { en: "Mobile number must be 10 digits.",     hi: "मोबाइल नंबर 10 अंकों का होना चाहिए।", mr: "मोबाईल नंबर 10 अंकी असावा."    },
  val_taluka:    { en: "Select a taluka from Nagpur district.",hi: "नागपुर जिले का तालुका चुनें।",     mr: "फक्त नागपूर जिल्ह्यातील तालुका निवडा." },
  val_village:   { en: "Please select a village.",             hi: "कृपया गाँव चुनें।",               mr: "कृपया गाव निवडा."               },
  val_gat:       { en: "Please enter gat number.",             hi: "कृपया गाट नंबर भरें।",            mr: "कृपया गट नंबर भरा."             },
  val_gps:       { en: "Capture farm GPS location first.",     hi: "पहले खेत का GPS लोकेशन लें।",     mr: "शेताचे location घ्या (GPS बटण दाबा)." },
  val_area:      { en: "Enter farm area in acres.",            hi: "खेत का क्षेत्र (एकड़) भरें।",    mr: "शेताचे क्षेत्र (एकर) भरा."      },
  val_submitFail:{ en: "Registration failed. Please try again.", hi: "पंजीकरण विफल। फिर से प्रयास करें।", mr: "नोंदणी अयशस्वी. पुन्हा प्रयत्न करा." },

  // ── GPS error messages ────────────────────────────────────────────────────
  gps_denied:    { en: "Location access denied. Go to browser site settings → Location → Allow.",
                   hi: "लोकेशन परमिशन नहीं दी। ब्राउजर में Site Settings → Location → Allow करें।",
                   mr: "Location access denied. Browser settings → Location → Allow करा." },
  gps_unavail:   { en: "GPS signal not found. Turn on phone GPS and try in open area.",
                   hi: "GPS सिग्नल नहीं मिला। फोन का GPS चालू करें और खुले में जाएं।",
                   mr: "GPS signal नाही मिला. Phone चा GPS on करा आणि open area मध्ये जा." },
  gps_timeout:   { en: "GPS timed out. Turn on phone GPS and try again.",
                   hi: "GPS timeout। फोन का GPS चालू है? फिर से try करें।",
                   mr: "GPS timeout. Phone चा GPS on आहे? पुन्हा try करा." },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dash_title:    { en: "My Farm",           hi: "मेरी खेती",      mr: "माझे शेत"         },
  dash_subtitle: { en: "My Farm Dashboard", hi: "मेरा फार्म डैशबोर्ड", mr: "My Farm Dashboard" },
  dash_refresh:  { en: "Refresh",           hi: "ताज़ा करें",     mr: "Refresh"           },
  dash_newFarm:  { en: "New Farm Registration", hi: "नई खेती नोंदणी", mr: "नवीन शेत नोंदणी" },
  dash_totalFarms:{ en: "Total Farms",      hi: "कुल खेतें",      mr: "Total Farms"       },
  dash_verified: { en: "Verified",          hi: "सत्यापित",       mr: "Verified"          },
  dash_processing:{ en: "Processing",       hi: "प्रक्रिया में",   mr: "Processing"        },
  dash_noFarm:   { en: "No farm registered yet", hi: "अभी कोई खेत नोंदणी नहीं", mr: "अजून शेत नोंदणी नाही" },
  dash_noFarmMsg:{ en: "No farm registered yet. Register your farm to start earning.",
                   hi: "अभी कोई खेत नोंदणी नहीं हुई। कमाई शुरू करने के लिए खेत नोंदणी करें।",
                   mr: "No farm registered yet. Register your farm to start earning." },
  dash_registerBtn:{ en: "Register farm",  hi: "खेत नोंदणी करें", mr: "शेत नोंदणी करा"  },
  dash_village:  { en: "Village",          hi: "गाँव",            mr: "गाव"              },
  dash_gatNo:    { en: "Gat No.",          hi: "गाट नंबर",        mr: "गट नंबर"          },
  dash_area:     { en: "Area (acres)",     hi: "क्षेत्र (एकड़)",  mr: "क्षेत्र (एकर)"    },
  dash_gps:      { en: "GPS",             hi: "जीपीएस",           mr: "GPS"              },
  dash_mobile:   { en: "Mobile",          hi: "मोबाइल",           mr: "मोबाईल"           },
  dash_status_minted:   { en: "✅ Verified — Carbon token minted on blockchain",
                          hi: "✅ सत्यापित — ब्लॉकचेन पर कार्बन टोकन मिंट हुआ",
                          mr: "✅ Verified — Carbon token minted on blockchain" },
  dash_status_burned:   { en: "🌿 Token sold — Credit retired",
                          hi: "🌿 टोकन बिक गया — क्रेडिट रिटायर हुआ",
                          mr: "🌿 Token sold — Credit retired" },
  dash_status_verified: { en: "🔬 Satellite verified — Awaiting token mint by admin",
                          hi: "🔬 सैटेलाइट सत्यापित — एडमिन द्वारा टोकन मिंट का इंतजार",
                          mr: "🔬 Satellite verified — Awaiting token mint by admin" },
  dash_status_pending:  { en: "⏳ Verification pending — satellite data processing…",
                          hi: "⏳ सत्यापन लंबित — सैटेलाइट डेटा प्रोसेस हो रहा है…",
                          mr: "⏳ Verification pending — satellite data processing…" },
  dash_ndvi:     { en: "NDVI Score",       hi: "NDVI स्कोर",      mr: "NDVI Score"       },
  dash_co2:      { en: "CO₂ Absorbed",     hi: "CO₂ अवशोषित",    mr: "CO₂ Absorbed"     },
  dash_earnings: { en: "Estimated Earnings", hi: "अनुमानित कमाई", mr: "Estimated Earnings" },
  dash_earnings80:{ en: "80% of token value", hi: "टोकन मूल्य का 80%", mr: "80% of token value" },
  dash_satellite:{ en: "Sentinel-2 Satellite", hi: "Sentinel-2 सैटेलाइट", mr: "Sentinel-2 Satellite" },
  dash_tpy:      { en: "tonnes per year",  hi: "टन प्रति वर्ष",  mr: "tonnes per year"   },
  dash_pending_title: { en: "Satellite analysis in progress",
                        hi: "सैटेलाइट विश्लेषण चल रहा है",
                        mr: "Satellite analysis in progress" },
  dash_pending_body:  { en: "Our team is calculating your NDVI score and CO₂ absorption using Copernicus satellite data. This usually takes a few hours.",
                        hi: "हमारी टीम Copernicus satellite data से आपका NDVI score और CO₂ absorption calculate कर रही है। इसमें कुछ घंटे लगते हैं।",
                        mr: "आमची टीम Copernicus satellite data वापरून तुमच्या शेताचे NDVI score आणि CO₂ absorption calculate करत आहे. हे साधारण काही तासांत होईल." },
  dash_pending_note:  { en: "Your NDVI score and CO₂ tonnes will appear here automatically once verified.",
                        hi: "NDVI score और CO₂ tonnes सत्यापित होने पर यहां अपने आप दिखेगा।",
                        mr: "Your NDVI score and CO₂ tonnes will appear here automatically once verified." },
  dash_polygonscan:   { en: "View on Polygonscan — Token verified on blockchain",
                        hi: "Polygonscan पर देखें — ब्लॉकचेन पर टोकन सत्यापित",
                        mr: "View on Polygonscan — Token verified on blockchain" },
  dash_loadFail: { en: "Failed to load farm data.", hi: "फार्म डेटा लोड नहीं हुआ।", mr: "Failed to load farm data." },
} as const;

export type TranslationKey = keyof typeof translations;

// ── Context ───────────────────────────────────────────────────────────────────

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
};

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations[key]["en"],
});

const STORAGE_KEY = "carbonsetu_lang";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    return (localStorage.getItem(STORAGE_KEY) as Lang) ?? "en";
  });

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  }

  function t(key: TranslationKey): string {
    return translations[key][lang];
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
