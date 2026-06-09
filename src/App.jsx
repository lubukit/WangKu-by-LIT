import { useState, useRef, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadString } from "firebase/storage";

// ─────────────────────────────────────────────────────────
// FIREBASE SETUP — ganti dengan config anda dari Firebase Console
// https://console.firebase.google.com → Project Settings → Your apps
// ─────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};
const isFilled = (value) => value && !String(value).startsWith("your_") && !String(value).includes("YOUR_");
const IS_FIREBASE_ENABLED = Object.values(FIREBASE_CONFIG).every(isFilled);
const firebaseApp = IS_FIREBASE_ENABLED ? initializeApp(FIREBASE_CONFIG) : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null;
const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

// ─────────────────────────────────────────────────────────
const PALETTES = {
  dark: {
    bg: "#0F0F13", surface: "#16161D", card: "#1C1C26", border: "#2A2A38",
    accent: "#7C6AF7", accentL: "#A594FF", green: "#2ECC8F", red: "#F05C6E",
    yellow: "#F0C93B", blue: "#4EA8DE", text: "#F0EFF8", muted: "#8888AA", dim: "#44445A",
  },
  light: {
    bg: "#F7F8FC", surface: "#FFFFFF", card: "#FFFFFF", border: "#DDE1EA",
    accent: "#5B4DE8", accentL: "#7264FF", green: "#14875D", red: "#D83D55",
    yellow: "#B98200", blue: "#2276B8", text: "#171821", muted: "#60657A", dim: "#A8ADBA",
  },
};
let C = PALETTES.dark;
let LANG = "ms";

const DEFAULT_CATEGORIES = [
  { id: "makan",      label: "Makan & Minum",  icon: "food", color: "#F05C6E", budget: 0 },
  { id: "transport",  label: "Transport",       icon: "car", color: "#4EA8DE", budget: 0 },
  { id: "utiliti",    label: "Utiliti & Bil",   icon: "bolt", color: "#F0C93B", budget: 0 },
  { id: "hiburan",    label: "Hiburan",         icon: "game", color: "#7C6AF7", budget: 0 },
  { id: "kesihatan",  label: "Kesihatan",       icon: "heart", color: "#2ECC8F", budget: 0 },
  { id: "belanja",    label: "Belanja-belah",   icon: "bag", color: "#FF8C42", budget: 0 },
  { id: "pendidikan", label: "Pendidikan",      icon: "book", color: "#A594FF", budget: 0 },
  { id: "lain",       label: "Lain-lain",       icon: "box", color: "#8888AA", budget: 0 },
];

const DEFAULT_PROFILE = {
  name: "",
  monthlyIncome: 0,
  currency: "RM",
  savingsTarget: 20,
};
const DEFAULT_PREFS = { theme: "dark", language: "ms" };

const T = {
  ms: {
    name: "Nama", main: "Utama", transactions: "Transaksi", budget: "Budget", goals: "Goals", scanner: "Resit", reports: "Laporan",
    dashboardTitle: "Dashboard", scannerTitle: "Resit & Bukti", settingsTitle: "Tetapan", profile: "Profil", bills: "Bil", data: "Data",
    appearance: "Paparan", dark: "Gelap", light: "Cerah", language: "Bahasa", malay: "Malay", english: "English",
    personalInfo: "Maklumat Peribadi", yourName: "Nama anda", saveProfile: "Simpan Profil", monthlyIncome: "Gaji / Pendapatan Bulanan",
    savingsTarget: "Sasaran Simpanan Bulanan (%)",
    saved: "Disimpan!", notifications: "Notifikasi", noNotifications: "Tiada notifikasi buat masa ini", close: "Tutup",
  },
  en: {
    name: "Name", main: "Home", transactions: "Transactions", budget: "Budget", goals: "Goals", scanner: "Receipt", reports: "Reports",
    dashboardTitle: "Dashboard", scannerTitle: "Receipts & Proofs", settingsTitle: "Settings", profile: "Profile", bills: "Bills", data: "Data",
    appearance: "Appearance", dark: "Dark", light: "Light", language: "Language", malay: "Malay", english: "English",
    personalInfo: "Personal Info", yourName: "Your name", saveProfile: "Save Profile", monthlyIncome: "Monthly Income",
    savingsTarget: "Monthly Savings Target (%)",
    saved: "Saved!", notifications: "Notifications", noNotifications: "No notifications right now", close: "Close",
  },
};
const tx = (key) => T[LANG]?.[key] || T.ms[key] || key;
const ICON_ALIASES = { "🍜": "food", "🚗": "car", "⚡": "bolt", "🎮": "game", "💊": "heart", "🛍️": "bag", "📚": "book", "📦": "box", "📌": "pin", "📄": "bill", "🎯": "target" };
const iconName = (name, fallback = "box") => ICON_ALIASES[name] || name || fallback;

const fmt = (n, currency = "RM") =>
  `${currency} ${Number(n || 0).toLocaleString("ms-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (a, b) => (b === 0 ? 0 : Math.min(100, Math.round((a / b) * 100)));
const todayStr = () => new Date().toISOString().split("T")[0];

function AppIcon({ name, size = 20, color = "currentColor", stroke = 2.2, style }) {
  const common = { fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <><path {...common} d="M3 10.5 12 3l9 7.5" /><path {...common} d="M5.5 9.5V21h13V9.5" /><path {...common} d="M9.5 21v-6h5v6" /></>,
    user: <><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M4.5 21c1.4-4 4-6 7.5-6s6.1 2 7.5 6" /></>,
    swap: <><path {...common} d="M7 7h13l-3-3" /><path {...common} d="M20 7l-3 3" /><path {...common} d="M17 17H4l3 3" /><path {...common} d="M4 17l3-3" /></>,
    wallet: <><path {...common} d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z" /><path {...common} d="M4 8h15" /><path {...common} d="M15 12h5v4h-5a2 2 0 0 1 0-4z" /></>,
    target: <><circle {...common} cx="12" cy="12" r="8" /><circle {...common} cx="12" cy="12" r="4" /><circle fill={color} cx="12" cy="12" r="1.4" /></>,
    receipt: <><path {...common} d="M7 3h10v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" /><path {...common} d="M9.5 8h5" /><path {...common} d="M9.5 12h5" /><path {...common} d="M9.5 16h3" /></>,
    chart: <><path {...common} d="M4 19V5" /><path {...common} d="M4 19h16" /><path {...common} d="M8 16v-5" /><path {...common} d="M12 16V8" /><path {...common} d="M16 16v-9" /></>,
    gear: <><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M12 2.8v2.3M12 18.9v2.3M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.8 12h2.3M18.9 12h2.3M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></>,
    bell: <><path {...common} d="M6 10a6 6 0 0 1 12 0v4l2 3H4l2-3z" /><path {...common} d="M9.5 20a3 3 0 0 0 5 0" /></>,
    moon: <path {...common} d="M20 15.5A8.5 8.5 0 0 1 8.5 4 7 7 0 1 0 20 15.5z" />,
    sun: <><circle {...common} cx="12" cy="12" r="4" /><path {...common} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    globe: <><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M3 12h18" /><path {...common} d="M12 3c2.4 2.4 3.5 5.4 3.5 9s-1.1 6.6-3.5 9c-2.4-2.4-3.5-5.4-3.5-9S9.6 5.4 12 3z" /></>,
    food: <><path {...common} d="M7 3v8" /><path {...common} d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3" /><path {...common} d="M7 11v10" /><path {...common} d="M16 3v18" /><path {...common} d="M16 3c3 1.8 4 4.2 4 7h-4" /></>,
    car: <><path {...common} d="M5 13l1.5-5h11L19 13" /><path {...common} d="M4 13h16v5H4z" /><circle {...common} cx="7" cy="18" r="1.5" /><circle {...common} cx="17" cy="18" r="1.5" /></>,
    bolt: <path {...common} d="M13 2 5 14h6l-1 8 9-13h-6z" />,
    game: <><path {...common} d="M7 10h10a4 4 0 0 1 3.7 5.5l-.6 1.5a2 2 0 0 1-3.4.5L15 16H9l-1.7 1.5a2 2 0 0 1-3.4-.5l-.6-1.5A4 4 0 0 1 7 10z" /><path {...common} d="M8 13v3M6.5 14.5h3" /><circle fill={color} cx="16" cy="14" r="1" /><circle fill={color} cx="18" cy="16" r="1" /></>,
    heart: <path {...common} d="M20 8.5c0 5-8 10-8 10s-8-5-8-10A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 8 3.5z" />,
    bag: <><path {...common} d="M6 8h12l-1 13H7z" /><path {...common} d="M9 8a3 3 0 0 1 6 0" /></>,
    book: <><path {...common} d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z" /><path {...common} d="M5 4v16" /><path {...common} d="M9 8h5" /></>,
    box: <><path {...common} d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" /><path {...common} d="M4 7.5 12 12l8-4.5" /><path {...common} d="M12 12v9" /></>,
    pin: <><path {...common} d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11z" /><circle {...common} cx="12" cy="10" r="2" /></>,
    bill: <><path {...common} d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z" /><path {...common} d="M10 8h4M10 12h4M10 16h2" /></>,
    camera: <><path {...common} d="M4 8h4l1.5-2h5L16 8h4v11H4z" /><circle {...common} cx="12" cy="13.5" r="3" /></>,
    image: <><rect {...common} x="4" y="5" width="16" height="14" rx="2" /><circle {...common} cx="9" cy="10" r="1.5" /><path {...common} d="m6 17 4-4 3 3 2-2 3 3" /></>,
    edit: <><path {...common} d="M4 20h4l10.5-10.5-4-4L4 16z" /><path {...common} d="m13.5 6.5 4 4" /></>,
    save: <><path {...common} d="M5 4h12l2 2v14H5z" /><path {...common} d="M8 4v6h8" /><path {...common} d="M8 20v-6h8v6" /></>,
    trash: <><path {...common} d="M4 7h16" /><path {...common} d="M9 7V4h6v3" /><path {...common} d="M7 7l1 14h8l1-14" /></>,
    check: <path {...common} d="m5 12 4 4L19 6" />,
    alert: <><path {...common} d="M12 3 2.5 20h19z" /><path {...common} d="M12 9v4" /><path {...common} d="M12 17h.01" /></>,
    ai: <><path {...common} d="M12 3v3M12 18v3M4.9 4.9 7 7M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /><circle {...common} cx="12" cy="12" r="4" /></>,
    bike: <><circle {...common} cx="6" cy="17" r="3" /><circle {...common} cx="18" cy="17" r="3" /><path {...common} d="M9 17l3-8 3 8M9.5 9H14M12 9l-3 8M12 9l6 8" /><path {...common} d="M14 6h3" /></>,
    phone: <><rect {...common} x="8" y="3" width="8" height="18" rx="2" /><path {...common} d="M11 18h2" /></>,
    laptop: <><path {...common} d="M5 5h14v10H5z" /><path {...common} d="M3 19h18l-2-4H5z" /></>,
    plane: <><path {...common} d="M3 11l18-7-7 18-3-8z" /><path {...common} d="M11 14 21 4" /></>,
    ring: <><circle {...common} cx="12" cy="14" r="6" /><path {...common} d="M9 6h6l-3-3z" /></>,
    baby: <><circle {...common} cx="12" cy="10" r="5" /><path {...common} d="M9 9h.01M15 9h.01" /><path {...common} d="M9.5 14c1.4 1.1 3.6 1.1 5 0" /><path {...common} d="M4 20c1.6-2.4 4.1-3.5 8-3.5s6.4 1.1 8 3.5" /></>,
    gift: <><rect {...common} x="4" y="9" width="16" height="11" rx="1" /><path {...common} d="M12 9v11M4 13h16" /><path {...common} d="M12 9c-4-1-5-5-2-5 1.5 0 2 2 2 5zM12 9c4-1 5-5 2-5-1.5 0-2 2-2 5z" /></>,
    cap: <><path {...common} d="M3 9l9-4 9 4-9 4z" /><path {...common} d="M7 11v4c3 2 7 2 10 0v-4" /><path {...common} d="M20 10v5" /></>,
    shield: <><path {...common} d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path {...common} d="m9 12 2 2 4-5" /></>,
    briefcase: <><path {...common} d="M9 7V5h6v2" /><rect {...common} x="4" y="7" width="16" height="12" rx="2" /><path {...common} d="M4 12h16M10 12v2h4v-2" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0, ...style }}>
      {paths[iconName(name)] || paths.box}
    </svg>
  );
}

function IconBubble({ name, color = C.accent, size = 20, box = 40, style, className = "" }) {
  return (
    <span className={`wk-icon-bubble ${className}`} style={{ width: box, height: box, borderRadius: Math.round(box * 0.3), background: color + "22", color, display: "inline-flex", alignItems: "center", justifyContent: "center", ...style }}>
      <AppIcon name={name} size={size} />
    </span>
  );
}

function CategoryIcon({ cat, size = 20, box = 40, style }) {
  return <IconBubble name={iconName(cat?.icon)} color={cat?.color || C.accent} size={size} box={box} style={style} />;
}

const GOAL_ICON_OPTIONS = [
  "target", "wallet", "home", "car", "bike", "plane", "book", "cap", "laptop", "phone",
  "heart", "baby", "ring", "gift", "briefcase", "shield", "bag", "camera", "pin", "box",
];

const motionStyles = (theme = "dark") => `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:0}
  select option{background:${C.card};color:${C.text}}
  input[type=date]::-webkit-calendar-picker-indicator{filter:${theme === "dark" ? "invert(.7)" : "none"}}
  button,.wk-field{transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .22s,border-color .22s,background .22s,color .22s,opacity .22s}
  button:hover,.wk-btn:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(0,0,0,.18)}
  button:active,.wk-btn:active{transform:translateY(1px) scale(.985);box-shadow:0 4px 14px rgba(0,0,0,.18)}
  .wk-field:focus{transform:translateY(-1px);border-color:${C.accent}!important;box-shadow:0 0 0 3px ${C.accent}22}
  .wk-page{animation:wkPageIn .42s cubic-bezier(.2,.8,.2,1) both}
  .wk-page>div{animation:wkCardIn .42s cubic-bezier(.2,.8,.2,1) both}
  .wk-page>div:nth-child(2){animation-delay:.04s}
  .wk-page>div:nth-child(3){animation-delay:.08s}
  .wk-page>div:nth-child(4){animation-delay:.12s}
  .wk-badge{animation:wkPop .28s cubic-bezier(.2,1.4,.3,1) both}
  .wk-progress-fill{position:relative;overflow:hidden}
  .wk-progress-fill:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.36),transparent);transform:translateX(-100%);animation:wkShimmer 2.2s ease-in-out infinite}
  .wk-icon-bubble{transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .22s,background .22s}
  button:hover .wk-icon-bubble,.wk-icon-bubble:hover{transform:translateY(-1px) rotate(-2deg) scale(1.04);box-shadow:0 10px 26px rgba(0,0,0,.16)}
  .wk-nav-button{position:relative;transition:transform .2s cubic-bezier(.2,.8,.2,1),background .2s}
  .wk-nav-button:hover{transform:translateY(-2px)}
  .wk-nav-active{animation:wkNavPop .32s cubic-bezier(.2,1.4,.3,1) both}
  .wk-nav-dot{animation:wkDot .32s cubic-bezier(.2,1.4,.3,1) both}
  .wk-modal{animation:wkModalShade .22s ease both}
  .wk-modal-card{animation:wkModalCard .32s cubic-bezier(.2,.9,.2,1) both}
  .wk-float{animation:wkFloat 4.5s ease-in-out infinite}
  .wk-ring circle{transition:stroke-dasharray .6s ease,stroke-dashoffset .6s ease}
  @keyframes wkPageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes wkCardIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes wkPop{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}
  @keyframes wkNavPop{0%{transform:translateY(0) scale(.92)}70%{transform:translateY(-2px) scale(1.08)}100%{transform:translateY(0) scale(1)}}
  @keyframes wkDot{from{transform:scaleX(.2);opacity:.2}to{transform:scaleX(1);opacity:1}}
  @keyframes wkShimmer{0%,35%{transform:translateX(-100%)}75%,100%{transform:translateX(100%)}}
  @keyframes wkFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
  @keyframes wkModalShade{from{opacity:0}to{opacity:1}}
  @keyframes wkModalCard{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
  @media (prefers-reduced-motion: reduce){
    *,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  }
`;

// ── Persistent storage (localStorage → Firebase when enabled) ──
const store = {
  get: (key, fallback) => {
    try { const v = localStorage.getItem("wangku_" + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem("wangku_" + key, JSON.stringify(value)); } catch {}
  },
};

const isDataUrl = (value) => typeof value === "string" && value.startsWith("data:image/");
const shortId = () => Math.random().toString(36).slice(2, 10);

async function uploadCloudImage(uid, folder, imageData, cache) {
  if (!IS_FIREBASE_ENABLED || !firebaseStorage || !uid || !isDataUrl(imageData)) return imageData || null;
  if (cache.has(imageData)) return cache.get(imageData);
  try {
    const storageRef = ref(firebaseStorage, `users/${uid}/${folder}/${Date.now()}-${shortId()}.jpg`);
    await uploadString(storageRef, imageData, "data_url");
    const url = await getDownloadURL(storageRef);
    cache.set(imageData, url);
    return url;
  } catch {
    cache.set(imageData, null);
    return null;
  }
}

async function prepareCloudData(uid, data, cache) {
  const next = JSON.parse(JSON.stringify(data));
  next.transactions = await Promise.all((next.transactions || []).map(async t => ({
    ...t,
    receiptImage: await uploadCloudImage(uid, "receipt-proofs", t.receiptImage, cache),
  })));
  next.scannedReceipts = await Promise.all((next.scannedReceipts || []).map(async r => ({
    ...r,
    items: Array.isArray(r.items) ? r.items.join(", ") : (r.items || ""),
    imageData: await uploadCloudImage(uid, "receipt-scans", r.imageData, cache),
  })));
  next.goals = await Promise.all((next.goals || []).map(async g => ({
    ...g,
    contributions: await Promise.all((g.contributions || []).map(async c => ({
      ...c,
      proofImage: await uploadCloudImage(uid, "goal-proofs", c.proofImage, cache),
    }))),
  })));
  next.updatedAt = new Date().toISOString();
  return next;
}

// ── Shared UI ─────────────────────────────────────────────
function ProgressBar({ value, max, color = C.accent, height = 6 }) {
  return (
    <div style={{ background: C.border, borderRadius: 99, height, overflow: "hidden" }}>
      <div className="wk-progress-fill" style={{ width: `${pct(value, max)}%`, height: "100%", background: color, borderRadius: 99, transition: "width .5s ease" }} />
    </div>
  );
}
function Badge({ children, color = C.accent }) {
  return <span className="wk-badge" style={{ background: color + "22", color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{children}</span>;
}
function Input({ label, ...props }) {
  return (
    <div>
      {label && <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>}
      <input {...props} className={`wk-field ${props.className || ""}`} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", width: "100%", ...(props.style || {}) }} />
    </div>
  );
}
function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>}
      <select {...props} className={`wk-field ${props.className || ""}`} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", width: "100%", ...(props.style || {}) }}>
        {children}
      </select>
    </div>
  );
}
function Btn({ children, variant = "primary", ...props }) {
  const styles = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    secondary: { background: C.card, color: C.muted, border: `1px solid ${C.border}` },
    danger: { background: C.red + "22", color: C.red, border: `1px solid ${C.red}44` },
    ghost: { background: "transparent", color: C.muted, border: `1px dashed ${C.border}` },
  };
  return (
    <button {...props} className={`wk-btn ${props.className || ""}`} style={{ ...styles[variant], borderRadius: 10, padding: "11px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, width: "100%", ...(props.style || {}) }}>
      {children}
    </button>
  );
}

// ── ONBOARDING ────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE });
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES.map(c => ({ ...c })));

  const totalBudget = categories.reduce((s, c) => s + Number(c.budget || 0), 0);
  const income = Number(profile.monthlyIncome || 0);
  const remaining = income - totalBudget;

  const steps = [
    {
      title: "Selamat Datang ke WangKu",
      subtitle: "App pengurusan kewangan peribadi anda. Mari setup dalam 3 langkah mudah.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <IconBubble name="wallet" color={C.accent} box={74} size={36} style={{ margin: "0 auto 12px" }} className="wk-float" />
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
              WangKu membantu anda track perbelanjaan, set budget, capai goals kewangan, dan simpan resit sebagai bukti transaksi.
            </div>
          </div>
          <Input label="Nama Anda" placeholder="cth: Ahmad" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
          <Select label="Mata Wang" value={profile.currency} onChange={e => setProfile({ ...profile, currency: e.target.value })}>
            <option value="RM">Ringgit Malaysia (RM)</option>
            <option value="USD">US Dollar (USD)</option>
            <option value="SGD">Singapore Dollar (SGD)</option>
          </Select>
        </div>
      ),
      canNext: profile.name.trim().length > 0,
    },
    {
      title: "Pendapatan Bulanan",
      subtitle: "Berapa pendapatan bersih anda sebulan? (Selepas potongan)",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Pendapatan Bulanan Bersih</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 20, color: C.muted }}>{profile.currency}</span>
              <input
                type="number"
                placeholder="0.00"
                value={profile.monthlyIncome || ""}
                onChange={e => setProfile({ ...profile, monthlyIncome: e.target.value })}
                style={{ background: "transparent", border: "none", outline: "none", fontSize: 36, fontWeight: 900, color: C.green, width: 180, textAlign: "center" }}
              />
            </div>
          </div>
          <Input
            label={`Sasaran Simpanan (%) — Disyor: 20%`}
            type="number"
            placeholder="20"
            value={profile.savingsTarget || ""}
            onChange={e => setProfile({ ...profile, savingsTarget: e.target.value })}
          />
          {income > 0 && (
            <div style={{ background: C.accent + "11", border: `1px solid ${C.accent}33`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, color: C.accentL }}>
                Dengan pendapatan {fmt(income, profile.currency)}, sasaran simpanan {profile.savingsTarget || 20}% = <strong>{fmt(income * (profile.savingsTarget || 20) / 100, profile.currency)}/bulan</strong>
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, padding: "0 4px" }}>
            Maklumat ini hanya disimpan di peranti anda dan tidak dikongsi dengan sesiapa.
          </div>
        </div>
      ),
      canNext: Number(profile.monthlyIncome) > 0,
    },
    {
      title: "Set Budget Kategori",
      subtitle: "Berapa nak peruntukkan untuk setiap kategori sebulan?",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {income > 0 && (
            <div style={{ background: remaining >= 0 ? C.green + "11" : C.red + "11", border: `1px solid ${remaining >= 0 ? C.green : C.red}44`, borderRadius: 12, padding: 12, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.muted }}>Pendapatan</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{fmt(income, profile.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: C.muted }}>Total Budget</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{fmt(totalBudget, profile.currency)}</span>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Baki / Simpanan</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: remaining >= 0 ? C.green : C.red }}>{fmt(remaining, profile.currency)}</span>
              </div>
            </div>
          )}
          {categories.map((cat, i) => (
            <div key={cat.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{cat.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{profile.currency}</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={cat.budget || ""}
                    onChange={e => {
                      const updated = [...categories];
                      updated[i] = { ...cat, budget: Number(e.target.value) };
                      setCategories(updated);
                    }}
                    style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: C.text, fontSize: 13, outline: "none", width: 110 }}
                  />
                  {income > 0 && cat.budget > 0 && (
                    <span style={{ fontSize: 11, color: C.muted }}>{pct(cat.budget, income)}%</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: C.dim, textAlign: "center", marginTop: 4 }}>Boleh ubah bila-bila masa dalam Settings</div>
        </div>
      ),
      canNext: true,
    },
  ];

  const current = steps[step];

  const finish = () => {
    onDone(profile, categories);
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text, maxWidth: 480, margin: "0 auto", padding: "0 0 40px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;800;900&display=swap'); *{box-sizing:border-box;margin:0;padding:0} select option{background:#1C1C26} input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.7)}`}</style>

      {/* Progress dots */}
      <div style={{ padding: "24px 20px 0", display: "flex", justifyContent: "center", gap: 8 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 99, background: i <= step ? C.accent : C.border, transition: "all .3s" }} />
        ))}
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 6 }}>{current.title}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.5 }}>{current.subtitle}</div>
        {current.content}
      </div>

      <div style={{ padding: "24px 20px 0", display: "flex", gap: 10 }}>
        {step > 0 && (
          <Btn variant="secondary" onClick={() => setStep(s => s - 1)} style={{ flex: 1 }}>← Balik</Btn>
        )}
        {step < steps.length - 1 ? (
          <Btn onClick={() => setStep(s => s + 1)} style={{ flex: 2 }} disabled={!current.canNext}>
            Seterusnya →
          </Btn>
        ) : (
          <Btn onClick={finish} style={{ flex: 2, background: C.green, fontSize: 15 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="check" size={17} /> Mula Guna WangKu!</span>
          </Btn>
        )}
      </div>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────
function Settings({ profile, setProfile, categories, setCategories, bills, setBills, prefs, setPrefs, scannedReceipts, authChoice, cloudStatus, onSwitchAccount, onReset }) {
  const [tab, setTab] = useState("profil");
  const [editCat, setEditCat] = useState(null);
  const [editBill, setEditBill] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveProfile = (updated) => {
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const income = Number(profile.monthlyIncome || 0);
  const totalBudget = categories.reduce((s, c) => s + Number(c.budget || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4 }}>
        {[["profil","user",tx("profile")],["budget","wallet",tx("budget")],["bil","bill",tx("bills")],["data","box",tx("data")]].map(([id,icon,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: tab === id ? C.accent : "transparent", border: "none", borderRadius: 9, padding: "8px 4px", color: tab === id ? "#fff" : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <AppIcon name={icon} size={16} />{label}
          </button>
        ))}
      </div>

      {saved && (
        <div style={{ background: C.green + "22", border: `1px solid ${C.green}44`, borderRadius: 10, padding: 10, textAlign: "center", fontSize: 13, color: C.green }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><AppIcon name="check" size={16} /> {tx("saved")}</span>
        </div>
      )}

      {/* ── TAB: PROFIL ── */}
      {tab === "profil" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>{tx("appearance")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{tx("appearance")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[["dark","moon",tx("dark")],["light","sun",tx("light")]].map(([theme, icon, label]) => (
                    <button key={theme} onClick={() => setPrefs(p => ({ ...p, theme }))} style={{ background: prefs.theme === theme ? C.accent : C.bg, border: `1px solid ${prefs.theme === theme ? C.accent : C.border}`, borderRadius: 10, color: prefs.theme === theme ? "#fff" : C.text, padding: "10px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 800, cursor: "pointer" }}>
                      <AppIcon name={icon} size={17} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{tx("language")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[["ms",tx("malay")],["en",tx("english")]].map(([language, label]) => (
                    <button key={language} onClick={() => setPrefs(p => ({ ...p, language }))} style={{ background: prefs.language === language ? C.accent : C.bg, border: `1px solid ${prefs.language === language ? C.accent : C.border}`, borderRadius: 10, color: prefs.language === language ? "#fff" : C.text, padding: "10px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 800, cursor: "pointer" }}>
                      <AppIcon name="globe" size={17} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>{tx("personalInfo")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label={tx("name")} placeholder={tx("yourName")} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
              <Select label="Mata Wang" value={profile.currency} onChange={e => setProfile({ ...profile, currency: e.target.value })}>
                <option value="RM">Ringgit Malaysia (RM)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="SGD">Singapore Dollar (SGD)</option>
              </Select>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Pendapatan & Sasaran</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label={`${tx("monthlyIncome")} (${profile.currency})`} type="number" placeholder="0.00" value={profile.monthlyIncome || ""} onChange={e => setProfile({ ...profile, monthlyIncome: e.target.value })} />
              <Input label={tx("savingsTarget")} type="number" placeholder="20" value={profile.savingsTarget || ""} onChange={e => setProfile({ ...profile, savingsTarget: e.target.value })} />
              {income > 0 && (
                <div style={{ background: C.accent + "11", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: C.accentL }}>
                    Sasaran simpan: <strong>{fmt(income * (profile.savingsTarget || 20) / 100, profile.currency)}/bulan</strong>
                    {" "}({profile.savingsTarget || 20}% daripada {fmt(income, profile.currency)})
                  </div>
                </div>
              )}
            </div>
          </div>
          <Btn onClick={() => saveProfile(profile)}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="save" size={16} /> {tx("saveProfile")}</span></Btn>
        </div>
      )}

      {/* ── TAB: BUDGET ── */}
      {tab === "budget" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted }}>Pendapatan</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{fmt(income, profile.currency)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.muted }}>Total Budget</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{fmt(totalBudget, profile.currency)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: C.muted }}>Baki</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: income - totalBudget >= 0 ? C.green : C.red }}>{fmt(income - totalBudget, profile.currency)}</div>
            </div>
          </div>

          {categories.map((cat, i) => (
            <div key={cat.id} style={{ background: C.card, border: `1px solid ${editCat === i ? C.accent + "88" : C.border}`, borderRadius: 14, padding: 14 }}>
              {editCat === i ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <select value={iconName(cat.icon)} onChange={e => { const u=[...categories]; u[i]={...cat,icon:e.target.value}; setCategories(u); }}
                      style={{ width: 92, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: C.text, outline: "none", fontSize: 12 }}>
                      {["food","car","bolt","game","heart","bag","book","box","pin"].map(icon => <option key={icon} value={icon}>{icon}</option>)}
                    </select>
                    <input value={cat.label} onChange={e => { const u=[...categories]; u[i]={...cat,label:e.target.value}; setCategories(u); }}
                      style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }} />
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{profile.currency}</span>
                    <input type="number" value={cat.budget || ""} placeholder="0" onChange={e => { const u=[...categories]; u[i]={...cat,budget:Number(e.target.value)}; setCategories(u); }}
                      style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 14, outline: "none", fontWeight: 700 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn onClick={() => setEditCat(null)} style={{ flex: 1 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="check" size={16} /> Simpan</span></Btn>
                    <Btn variant="danger" onClick={() => { setCategories(prev => prev.filter((_,j) => j !== i)); setEditCat(null); }} style={{ flex: 1 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="trash" size={16} /> Padam</span></Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }} onClick={() => setEditCat(i)}>
                  <CategoryIcon cat={cat} box={38} size={19} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{cat.label}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>Budget: {fmt(cat.budget, profile.currency)}</div>
                  </div>
                  <span style={{ fontSize: 12, color: C.accent, display: "inline-flex", alignItems: "center", gap: 5 }}><AppIcon name="edit" size={12} /> Edit</span>
                </div>
              )}
            </div>
          ))}

          <Btn variant="ghost" onClick={() => setCategories(prev => [...prev, { id: "cat_" + Date.now(), label: "Kategori Baru", icon: "pin", color: C.accent, budget: 0 }])}>
            + Tambah Kategori
          </Btn>
          <Btn onClick={() => { store.set("categories", categories); setSaved(true); setTimeout(() => setSaved(false), 2000); }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="save" size={16} /> Simpan Budget</span></Btn>
        </div>
      )}

      {/* ── TAB: BIL ── */}
      {tab === "bil" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: C.muted, padding: "0 2px" }}>Senarai bil & langganan bulanan anda</div>
          {bills.map((bill, i) => (
            <div key={bill.id} style={{ background: C.card, border: `1px solid ${editBill === i ? C.accent + "88" : C.border}`, borderRadius: 14, padding: 14 }}>
              {editBill === i ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={iconName(bill.icon, "bill")} onChange={e => { const u=[...bills]; u[i]={...bill,icon:e.target.value}; setBills(u); }}
                      style={{ width: 92, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: C.text, outline: "none", fontSize: 12 }}>
                      {["bill","bolt","wallet","box","pin"].map(icon => <option key={icon} value={icon}>{icon}</option>)}
                    </select>
                    <input value={bill.name} onChange={e => { const u=[...bills]; u[i]={...bill,name:e.target.value}; setBills(u); }}
                      style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Jumlah ({profile.currency})</div>
                      <input type="number" value={bill.amount || ""} onChange={e => { const u=[...bills]; u[i]={...bill,amount:Number(e.target.value)}; setBills(u); }}
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Hari Due (1-31)</div>
                      <input type="number" min="1" max="31" value={bill.dueDay || ""} onChange={e => { const u=[...bills]; u[i]={...bill,dueDay:Number(e.target.value)}; setBills(u); }}
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn onClick={() => setEditBill(null)} style={{ flex: 1 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="check" size={16} /> Simpan</span></Btn>
                    <Btn variant="danger" onClick={() => { setBills(prev => prev.filter((_,j) => j !== i)); setEditBill(null); }} style={{ flex: 1 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="trash" size={16} /> Padam</span></Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }} onClick={() => setEditBill(i)}>
                  <IconBubble name={iconName(bill.icon, "bill")} color={C.blue} box={38} size={19} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{bill.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{fmt(bill.amount, profile.currency)} • Due: {bill.dueDay} haribulan</div>
                  </div>
                  <span style={{ fontSize: 12, color: C.accent, display: "inline-flex", alignItems: "center", gap: 5 }}><AppIcon name="edit" size={12} /> Edit</span>
                </div>
              )}
            </div>
          ))}
          <Btn variant="ghost" onClick={() => setBills(prev => [...prev, { id: Date.now(), name: "Bil Baru", icon: "bill", amount: 0, dueDay: 1, category: "utiliti" }])}>
            + Tambah Bil
          </Btn>
          <Btn onClick={() => { store.set("bills", bills); setSaved(true); setTimeout(() => setSaved(false), 2000); }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="save" size={16} /> Simpan Bil</span></Btn>
        </div>
      )}

      {/* ── TAB: DATA ── */}
      {tab === "data" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name="globe" size={16} /> Firebase Sync</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
              {IS_FIREBASE_ENABLED ? "Firebase aktif — data disimpan ke Firestore dan gambar bukti ke Storage." : "Firebase belum dikonfigurasi. Data disimpan secara tempatan (localStorage)."}
            </div>
            <div style={{ background: (cloudStatus || "").includes("gagal") ? C.red + "11" : IS_FIREBASE_ENABLED ? C.green + "11" : C.yellow + "11", border: `1px solid ${(cloudStatus || "").includes("gagal") ? C.red : IS_FIREBASE_ENABLED ? C.green : C.yellow}44`, borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, color: (cloudStatus || "").includes("gagal") ? C.red : IS_FIREBASE_ENABLED ? C.green : C.yellow }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name={(cloudStatus || "").includes("gagal") ? "alert" : IS_FIREBASE_ENABLED ? "check" : "alert"} size={14} /> {IS_FIREBASE_ENABLED ? cloudStatus : "Mode Offline — isi .env Firebase dahulu"}</span>
              </div>
            </div>
            {IS_FIREBASE_ENABLED && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: C.muted }}>Mode semasa: {authChoice === "sync" ? "Sync Account" : "Personal Mode"}</div>
                <Btn variant="secondary" onClick={onSwitchAccount}>Tukar Personal / Sync Account</Btn>
              </div>
            )}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name="save" size={16} /> Export Data</div>
            <Btn variant="secondary" onClick={() => {
              const data = { profile, categories, bills, transactions: store.get("transactions", []), goals: store.get("goals", []), scannedReceipts, exported: new Date().toISOString() };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `wangku-backup-${todayStr()}.json`; a.click();
            }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="save" size={16} /> Export JSON Backup</span>
            </Btn>
          </div>

          <div style={{ background: C.red + "11", border: `1px solid ${C.red}44`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name="alert" size={16} /> Danger Zone</div>
            {!showResetConfirm ? (
              <Btn variant="danger" onClick={() => setShowResetConfirm(true)}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="trash" size={16} /> Reset Semua Data</span></Btn>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: C.red }}>Adakah anda pasti? Semua data akan dipadam!</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="danger" onClick={onReset} style={{ flex: 1 }}>Ya, Padam</Btn>
                  <Btn variant="secondary" onClick={() => setShowResetConfirm(false)} style={{ flex: 1 }}>Batal</Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────
function Dashboard({ transactions, goals, categories, profile, setPage }) {
  const inc = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const bal = inc - exp;
  const manualIncome = Number(profile.monthlyIncome || 0);
  const totalIncome = inc || manualIncome;
  const savRate = totalIncome > 0 ? ((totalIncome - exp) / totalIncome * 100).toFixed(1) : 0;

  const catSpend = {};
  categories.forEach(c => { catSpend[c.id] = 0; });
  transactions.filter(t => t.type === "expense").forEach(t => { if (catSpend[t.category] !== undefined) catSpend[t.category] += t.amount; });

  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const isEmpty = transactions.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Welcome */}
      {profile.name && (
        <div style={{ fontSize: 15, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name="user" size={17} color={C.accent} /> Helo, <span style={{ color: C.text, fontWeight: 700 }}>{profile.name}</span></div>
      )}

      {/* Hero balance */}
      <div style={{ background: `linear-gradient(135deg, ${C.accent}22, ${C.accentL}11)`, border: `1px solid ${C.accent}44`, borderRadius: 18, padding: 22 }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Baki Bulan Ini</div>
        <div style={{ fontSize: 34, fontWeight: 900, color: bal >= 0 ? C.green : C.red, letterSpacing: -1, marginBottom: 16 }}>
          {fmt(bal, profile.currency)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", gap: 8, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted }}>Masuk</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt(inc, profile.currency)}</div>
          </div>
          <div style={{ background: C.border, height: 28 }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.muted }}>Keluar</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{fmt(exp, profile.currency)}</div>
          </div>
          <div style={{ background: C.border, height: 28 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.muted }}>Simpan</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{savRate}%</div>
          </div>
        </div>
      </div>

      {/* Empty state nudge */}
      {isEmpty && (
        <div style={{ background: C.card, border: `2px dashed ${C.border}`, borderRadius: 16, padding: 24, textAlign: "center" }}>
          <IconBubble name="chart" color={C.accent} box={58} size={28} className="wk-float" style={{ margin: "0 auto 10px" }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Tiada transaksi lagi</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Mula rekod perbelanjaan atau simpan bukti resit anda</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => setPage("transactions")} style={{ flex: 1, fontSize: 12 }}>+ Tambah Transaksi</Btn>
            <Btn variant="secondary" onClick={() => setPage("scanner")} style={{ flex: 1, fontSize: 12 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><AppIcon name="receipt" size={15} /> Simpan Resit</span></Btn>
          </div>
        </div>
      )}

      {/* Category budget cards */}
      {categories.some(c => c.budget > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {categories.filter(c => c.budget > 0).slice(0, 4).map(cat => {
            const spent = catSpend[cat.id] || 0;
            const over = spent > cat.budget;
            return (
              <div key={cat.id} style={{ background: C.card, border: `1px solid ${over ? C.red + "55" : C.border}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <CategoryIcon cat={cat} box={34} size={18} />
                  {over && <Badge color={C.red}>Lebih!</Badge>}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>{cat.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: over ? C.red : C.text }}>{fmt(spent, profile.currency)}</div>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 5 }}>/ {fmt(cat.budget, profile.currency)}</div>
                <ProgressBar value={spent} max={cat.budget} color={over ? C.red : cat.color} />
              </div>
            );
          })}
        </div>
      )}

      {/* Recent transactions */}
      {recent.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Transaksi Terkini</div>
          {recent.map((t, i) => {
            const cat = categories.find(c => c.id === t.category);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "9px 0", borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : "none" }}>
                {t.fromReceipt ? <IconBubble name="receipt" color={C.accent} box={36} size={18} style={{ marginRight: 12 }} /> : <CategoryIcon cat={cat} box={36} size={18} style={{ marginRight: 12 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.desc}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{t.date}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.type === "income" ? C.green : C.red }}>
                  {t.type === "income" ? "+" : "-"}{fmt(t.amount, profile.currency)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goals summary */}
      {goals.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Goals</div>
          {goals.map(g => (
            <div key={g.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><AppIcon name={iconName(g.icon, "target")} size={15} color={g.color || C.accent} /> {g.title}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{pct(g.saved, g.target)}%</span>
              </div>
              <ProgressBar value={g.saved} max={g.target} color={g.color} height={5} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TRANSACTIONS ──────────────────────────────────────────
function Transactions({ transactions, setTransactions, categories, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const blank = { desc: "", amount: "", type: "expense", category: categories[0]?.id || "lain", date: todayStr(), account: "cash" };
  const [form, setForm] = useState(blank);

  const filtered = transactions.filter(t => {
    if (filter !== "all" && t.type !== filter) return false;
    if (search && !t.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const save = () => {
    if (!form.desc || !form.amount) return;
    if (editId) {
      setTransactions(prev => prev.map(t => t.id === editId ? { ...form, id: editId, amount: parseFloat(form.amount) } : t));
      setEditId(null);
    } else {
      setTransactions(prev => [{ ...form, id: Date.now(), amount: parseFloat(form.amount) }, ...prev]);
    }
    setForm(blank); setShowForm(false);
  };

  const startEdit = (t) => {
    setForm({ desc: t.desc, amount: t.amount, type: t.type, category: t.category, date: t.date, account: t.account, fromReceipt: t.fromReceipt, receiptImage: t.receiptImage });
    setEditId(t.id);
    setShowForm(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none" }} />
        <button onClick={() => { setForm(blank); setEditId(null); setShowForm(!showForm); }}
          style={{ background: C.accent, border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 20 }}>+</button>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {[["all","Semua"],["income","Masuk"],["expense","Keluar"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ flex: 1, background: filter === v ? C.accent : C.card, border: `1px solid ${filter === v ? C.accent : C.border}`, borderRadius: 10, padding: "8px 0", color: filter === v ? "#fff" : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {showForm && (
        <div style={{ background: C.card, border: `1px solid ${C.accent}55`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accentL, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name={editId ? "edit" : "swap"} size={16} /> {editId ? "Edit Transaksi" : "Transaksi Baru"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input placeholder="Penerangan (cth: Lunch Mamak)" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
            <div style={{ display: "flex", gap: 8 }}>
              <Input placeholder="Jumlah" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} style={{ flex: 1 }} />
              <Select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={{ flex: 1 }}>
                <option value="expense">Keluar</option>
                <option value="income">Masuk</option>
              </Select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Select value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={{ flex: 1 }}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
              <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={{ flex: 1 }} />
            </div>
            <Select value={form.account} onChange={e => setForm({...form, account: e.target.value})}>
              <option value="cash">Tunai</option>
              <option value="maybank">Maybank</option>
              <option value="cimb">CIMB</option>
              <option value="rh">RHB</option>
              <option value="tng">Touch 'n Go</option>
              <option value="grabpay">GrabPay</option>
              <option value="boost">Boost</option>
              <option value="card">Kad Kredit</option>
            </Select>
            {form.receiptImage && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Bukti Resit</div>
                <img src={form.receiptImage} alt="Bukti resit" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 10, background: "#111" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={save} style={{ flex: 2 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="check" size={16} /> {editId ? "Kemaskini" : "Simpan"}</span></Btn>
              <Btn variant="secondary" onClick={() => { setShowForm(false); setEditId(null); setForm(blank); }} style={{ flex: 1 }}>Batal</Btn>
            </div>
            {editId && <Btn variant="danger" onClick={() => { setTransactions(prev => prev.filter(t => t.id !== editId)); setShowForm(false); setEditId(null); }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="trash" size={16} /> Padam Transaksi</span></Btn>}
          </div>
        </div>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
            <IconBubble name="box" color={C.dim} box={52} size={25} style={{ margin: "0 auto 8px" }} />
            Tiada transaksi
          </div>
        )}
        {filtered.map((t, i) => {
          const cat = categories.find(c => c.id === t.category);
          return (
            <div key={t.id} onClick={() => startEdit(t)} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer" }}>
              {t.fromReceipt ? <IconBubble name="receipt" color={C.accent} box={38} size={19} style={{ marginRight: 12 }} /> : <CategoryIcon cat={cat} box={38} size={19} style={{ marginRight: 12 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.desc}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{t.date} · {t.account}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.type === "income" ? C.green : C.red }}>
                  {t.type === "income" ? "+" : "-"}{fmt(t.amount, profile.currency)}
                </div>
                <div style={{ fontSize: 10, color: C.dim }}>ketik edit</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BUDGET ────────────────────────────────────────────────
function Budget({ transactions, categories, profile }) {
  const catSpend = {};
  categories.forEach(c => { catSpend[c.id] = 0; });
  transactions.filter(t => t.type === "expense").forEach(t => { if (catSpend[t.category] !== undefined) catSpend[t.category] += t.amount; });
  const totalBudget = categories.reduce((s, c) => s + Number(c.budget || 0), 0);
  const totalSpent = Object.values(catSpend).reduce((s, v) => s + v, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          {[["Total Budget", totalBudget, C.text], ["Dibelanjakan", totalSpent, C.red], ["Baki", totalBudget - totalSpent, totalBudget - totalSpent >= 0 ? C.green : C.red]].map(([l, v, col]) => (
            <div key={l} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: col }}>{fmt(v, profile.currency)}</div>
            </div>
          ))}
        </div>
        <ProgressBar value={totalSpent} max={totalBudget || 1} color={totalSpent > totalBudget ? C.red : C.accent} height={8} />
        <div style={{ textAlign: "right", fontSize: 10, color: C.muted, marginTop: 4 }}>{pct(totalSpent, totalBudget || 1)}% digunakan</div>
      </div>

      {categories.map(cat => {
        const spent = catSpend[cat.id] || 0;
        const over = cat.budget > 0 && spent > cat.budget;
        const remaining = cat.budget - spent;
        return (
          <div key={cat.id} style={{ background: C.card, border: `1px solid ${over ? C.red + "55" : C.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <CategoryIcon cat={cat} box={40} size={20} style={{ marginRight: 12 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{cat.label}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{cat.budget > 0 ? `Budget: ${fmt(cat.budget, profile.currency)}` : "Tiada budget ditetapkan"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: over ? C.red : C.text }}>{fmt(spent, profile.currency)}</div>
                {cat.budget > 0 && <div style={{ fontSize: 11, color: over ? C.red : C.green }}>{over ? `+${fmt(-remaining, profile.currency)} lebih` : `${fmt(remaining, profile.currency)} lagi`}</div>}
              </div>
            </div>
            {cat.budget > 0 && <ProgressBar value={spent} max={cat.budget} color={over ? C.red : cat.color} />}
          </div>
        );
      })}
    </div>
  );
}

// ── GOALS ─────────────────────────────────────────────────
function Goals({ goals, setGoals, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { title: "", target: "", saved: "0", deadline: "", icon: "target", color: C.accent };
  const [form, setForm] = useState(blank);
  const [pendingContribution, setPendingContribution] = useState(null);
  const [selectedGoalProof, setSelectedGoalProof] = useState(null);
  const proofCameraRef = useRef();
  const proofFileRef = useRef();

  const save = () => {
    if (!form.title || !form.target) return;
    const entry = { ...form, target: parseFloat(form.target), saved: parseFloat(form.saved || 0) };
    if (editId) {
      setGoals(prev => prev.map(g => g.id === editId ? { ...entry, id: editId, contributions: g.contributions || [] } : g));
      setEditId(null);
    } else {
      setGoals(prev => [...prev, { ...entry, id: Date.now(), contributions: [] }]);
    }
    setForm(blank); setShowForm(false);
  };

  const startEdit = (g) => {
    setForm({ title: g.title, target: g.target, saved: g.saved, deadline: g.deadline || "", icon: g.icon, color: g.color });
    setEditId(g.id); setShowForm(true);
  };

  const openContributionProof = (goalId, amount) => {
    setPendingContribution({ goalId, amount });
  };

  const completeContribution = (proofImage = null) => {
    if (!pendingContribution) return;
    const { goalId, amount } = pendingContribution;
    const proof = { id: Date.now(), amount, date: todayStr(), proofImage };
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        saved: Math.min(Number(g.target || 0), Number(g.saved || 0) + amount),
        contributions: [proof, ...(g.contributions || [])],
      };
    }));
    setPendingContribution(null);
  };

  const handleProofFile = (file) => {
    if (!file || !pendingContribution) return;
    const reader = new FileReader();
    reader.onload = e => completeContribution(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Btn onClick={() => { setForm(blank); setEditId(null); setShowForm(!showForm); }}>+ Tambah Goal Baru</Btn>

      {showForm && (
        <div style={{ background: C.card, border: `1px solid ${C.accent}55`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accentL, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name={editId ? "edit" : "target"} size={16} /> {editId ? "Edit Goal" : "Goal Baru"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input placeholder="Nama goal (cth: Beli Rumah)" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <div style={{ display: "flex", gap: 8 }}>
              <Input placeholder="Target (RM)" type="number" value={form.target} onChange={e => setForm({...form, target: e.target.value})} style={{ flex: 1 }} />
              <Input placeholder="Ada simpan" type="number" value={form.saved} onChange={e => setForm({...form, saved: e.target.value})} style={{ flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} style={{ flex: 1 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Pilih icon goal</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {GOAL_ICON_OPTIONS.map(icon => {
                  const active = iconName(form.icon, "target") === icon;
                  return (
                    <button key={icon} aria-label={icon} onClick={() => setForm({...form, icon})} type="button"
                      style={{ height: 42, background: active ? C.accent + "22" : C.bg, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 10, color: active ? C.accentL : C.muted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <AppIcon name={icon} size={21} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={save} style={{ flex: 2 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="check" size={16} /> {editId ? "Kemaskini" : "Simpan"}</span></Btn>
              <Btn variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }} style={{ flex: 1 }}>Batal</Btn>
            </div>
            {editId && <Btn variant="danger" onClick={() => { setGoals(prev => prev.filter(g => g.id !== editId)); setShowForm(false); setEditId(null); }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="trash" size={16} /> Padam</span></Btn>}
          </div>
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <div style={{ background: C.card, border: `2px dashed ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <IconBubble name="target" color={C.accent} box={58} size={28} className="wk-float" style={{ margin: "0 auto 8px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Tiada goal lagi</div>
          <div style={{ fontSize: 13, color: C.muted }}>Tetapkan matlamat kewangan anda!</div>
        </div>
      )}

      {goals.map(g => {
        const p = pct(g.saved, g.target);
        const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date()) / 86400000) : null;
        const remaining = g.target - g.saved;
        const monthlyNeeded = daysLeft && daysLeft > 0 ? (remaining / (daysLeft / 30)).toFixed(2) : null;
        return (
          <div key={g.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 14 }}>
              <IconBubble name={iconName(g.icon, "target")} color={g.color || C.accent} box={48} size={23} style={{ marginRight: 14 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{g.title}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  {daysLeft !== null && <Badge color={daysLeft < 30 ? C.red : C.blue}>{daysLeft > 0 ? `${daysLeft} hari` : "Tamat!"}</Badge>}
                  {p >= 100 && <Badge color={C.green}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="check" size={12} /> Selesai!</span></Badge>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: g.color }}>{p}%</div>
                <button onClick={() => startEdit(g)} style={{ background: C.accent + "22", border: "none", borderRadius: 8, padding: "4px 10px", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><AppIcon name="edit" size={12} /> Edit</button>
              </div>
            </div>
            <ProgressBar value={g.saved} max={g.target} color={g.color} height={8} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, marginBottom: 14 }}>
              <div><div style={{ fontSize: 10, color: C.muted }}>Terkumpul</div><div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(g.saved, profile.currency)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.muted }}>Target</div><div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(g.target, profile.currency)}</div></div>
            </div>
            {monthlyNeeded && p < 100 && (
              <div style={{ background: g.color + "11", border: `1px solid ${g.color}33`, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: g.color, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name="pin" size={14} /> Perlu simpan <strong>{fmt(monthlyNeeded, profile.currency)}/bulan</strong></div>
              </div>
            )}
            {p < 100 && (
              <div style={{ display: "flex", gap: 6 }}>
                {[100, 500, 1000].map(amt => (
                  <button key={amt} onClick={() => openContributionProof(g.id, amt)}
                    style={{ flex: 1, background: C.border, border: "none", borderRadius: 8, padding: "8px 0", color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    +{profile.currency}{amt}
                  </button>
                ))}
              </div>
            )}
            {(g.contributions || []).length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Bukti bayaran</div>
                {(g.contributions || []).slice(0, 3).map(c => (
                  <button key={c.id} onClick={() => setSelectedGoalProof({ goal: g, contribution: c })} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", color: C.text, display: "flex", alignItems: "center", gap: 10, marginBottom: 6, cursor: "pointer", textAlign: "left" }}>
                    {c.proofImage ? <img src={c.proofImage} alt="Bukti bayaran" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover" }} /> : <IconBubble name="receipt" color={C.dim} box={34} size={17} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>+{fmt(c.amount, profile.currency)}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{c.date} · {c.proofImage ? "Ada bukti" : "Tanpa resit"}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {pendingContribution && (
        <div className="wk-modal" style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div className="wk-modal-card" style={{ width: "100%", maxWidth: 430, background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}>
            <IconBubble name="receipt" color={C.accent} box={58} size={28} className="wk-float" style={{ margin: "0 auto 12px" }} />
            <div style={{ textAlign: "center", fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Bukti Bayaran</div>
            <div style={{ textAlign: "center", fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>
              Sila snap atau upload resit untuk tambah {fmt(pendingContribution.amount, profile.currency)} ke goal.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Btn onClick={() => proofCameraRef.current?.click()}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="camera" size={16} /> Snap Resit</span></Btn>
              <Btn variant="secondary" onClick={() => proofFileRef.current?.click()}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="image" size={16} /> Upload Resit</span></Btn>
              <input ref={proofCameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleProofFile(e.target.files[0])} />
              <input ref={proofFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleProofFile(e.target.files[0])} />
              <Btn variant="ghost" onClick={() => completeContribution(null)}>Tanpa resit</Btn>
              <Btn variant="secondary" onClick={() => setPendingContribution(null)}>Batal</Btn>
            </div>
          </div>
        </div>
      )}
      {selectedGoalProof && (
        <div className="wk-modal" style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div className="wk-modal-card" style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflow: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900 }}>Bukti Bayaran Goal</div>
                <div style={{ fontSize: 11, color: C.muted }}>{selectedGoalProof.goal.title} · +{fmt(selectedGoalProof.contribution.amount, profile.currency)}</div>
              </div>
              <button aria-label="Tutup bukti bayaran" onClick={() => setSelectedGoalProof(null)} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontWeight: 900 }}>x</button>
            </div>
            {selectedGoalProof.contribution.proofImage ? (
              <img src={selectedGoalProof.contribution.proofImage} alt="Bukti bayaran goal" style={{ width: "100%", maxHeight: "68vh", objectFit: "contain", background: "#111", borderRadius: 12, border: `1px solid ${C.border}` }} />
            ) : (
              <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: 24, textAlign: "center", color: C.muted }}>Bayaran ini direkod tanpa resit.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── RECEIPTS & PROOFS ─────────────────────────────────────
function ReceiptScanner({ setTransactions, categories, profile, scannedReceipts, setScannedReceipts }) {
  const [step, setStep] = useState("idle");
  const [imageData, setImageData] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const fileRef = useRef(); const cameraRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = e => { setImageData(e.target.result); setStep("preview"); setError(null); setScanResult(null); };
    r.readAsDataURL(file);
  };

  const openReceiptForm = () => {
    setScanResult(null);
    setEditForm({
      desc: "",
      amount: "",
      category: categories[0]?.id || "lain",
      date: todayStr(),
      type: "expense",
      account: "cash",
    });
    setStep("result");
  };

  const confirmSave = () => {
    if (!editForm.desc || !editForm.amount) return;
    const newTx = { id: Date.now(), ...editForm, amount: parseFloat(editForm.amount), fromReceipt: true, receiptImage: imageData || null };
    setTransactions(prev => [newTx, ...prev]);
    setScannedReceipts(prev => [{ ...newTx, imageData: imageData || null, items: scanResult?.items || [] }, ...prev]);
    setStep("saved");
  };

  const reset = () => { setStep("idle"); setImageData(null); setScanResult(null); setEditForm(null); setError(null); };
  const inp = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", width: "100%" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {step === "idle" && (
        <>
          <div style={{ background: `linear-gradient(135deg,${C.accent}22,${C.blue}11)`, border: `2px dashed ${C.accent}66`, borderRadius: 20, padding: 30, textAlign: "center" }}>
            <IconBubble name="receipt" color={C.accent} box={66} size={32} className="wk-float" style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Simpan Resit & Bukti</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>Ambil gambar atau upload resit, isi butiran, kemudian simpan sebagai transaksi.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Btn onClick={() => cameraRef.current?.click()}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="camera" size={16} /> Ambil Gambar Resit</span></Btn>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="image" size={16} /> Upload dari Galeri</span></Btn>
              <Btn variant="ghost" onClick={() => { setImageData(null); openReceiptForm(); }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="edit" size={16} /> Isi Manual</span></Btn>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          </div>
          {scannedReceipts.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>Resit Diimbas ({scannedReceipts.length})</div>
              {scannedReceipts.map((r, i) => {
                const cat = categories.find(c => c.id === r.category);
                return (
                  <button key={r.id} onClick={() => setSelectedReceipt(r)} style={{ width: "100%", background: "transparent", border: "none", color: C.text, display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: i < scannedReceipts.length - 1 ? `1px solid ${C.border}` : "none", gap: 10, cursor: "pointer", textAlign: "left" }}>
                    {r.imageData ? <img src={r.imageData} alt="Bukti resit" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.border}` }} /> : <IconBubble name="receipt" color={C.dim} box={44} size={21} />}
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{r.desc}</div><div style={{ fontSize: 11, color: C.muted }}>{r.date} · {cat?.label}</div></div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>-{fmt(r.amount, profile.currency)}</div>
                      <div style={{ fontSize: 10, color: r.imageData ? C.accent : C.dim }}>{r.imageData ? "Lihat bukti" : "Manual"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {step === "preview" && imageData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name="image" size={16} /> Semak Imej</div>
            <img src={imageData} alt="resit" style={{ width: "100%", maxHeight: 380, objectFit: "contain", background: "#111", display: "block" }} />
            <div style={{ padding: "8px 16px", fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name="pin" size={13} /> Gambar ini akan disimpan sebagai bukti transaksi</div>
          </div>
          {error && (
            <div style={{ background: C.red + "11", border: `1px solid ${C.red}44`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name="alert" size={15} /> Gagal mengimbas</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{error}</div>
              <Btn variant="ghost" onClick={openReceiptForm} style={{ fontSize: 12 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="edit" size={16} /> Isi Manual Sahaja</span></Btn>
            </div>
          )}
          <Btn onClick={openReceiptForm}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="edit" size={16} /> Isi Butiran Resit</span></Btn>
          <Btn variant="secondary" onClick={reset}>← Pilih Gambar Lain</Btn>
        </div>
      )}

      {step === "scanning" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.card, border: `1px solid ${C.accent}44`, borderRadius: 20, padding: 30, textAlign: "center" }}>
            <IconBubble name="ai" color={C.accent} box={62} size={30} style={{ margin: "0 auto 12px", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Menyediakan Resit...</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>Sediakan borang untuk disimpan</div>
            <div style={{ background: C.border, borderRadius: 99, height: 6, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", background: `linear-gradient(90deg,${C.accent},${C.accentL})`, borderRadius: 99, animation: "bar 2s ease-in-out infinite" }} />
            </div>
          </div>
          {imageData && <img src={imageData} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 12, opacity: 0.5, filter: "blur(1px)" }} />}
          <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}} @keyframes bar{0%{width:0%}50%{width:70%}100%{width:100%}}`}</style>
        </div>
      )}

      {step === "result" && editForm && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {scanResult ? (
              <Badge color={scanResult.confidence === "high" ? C.green : scanResult.confidence === "medium" ? C.yellow : C.red}>
                {scanResult.confidence === "high" ? "Keyakinan Tinggi" : scanResult.confidence === "medium" ? "Semak Semula" : "Semak Semula"}
              </Badge>
            ) : <Badge color={C.yellow}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="edit" size={12} /> Manual</span></Badge>}
            <span style={{ fontSize: 12, color: C.muted }}>Semak & betulkan maklumat</span>
          </div>
          {scanResult?.confidence === "low" && (
            <div style={{ background: C.yellow + "11", border: `1px solid ${C.yellow}33`, borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, color: C.yellow, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name="alert" size={14} /> Sila semak semua medan sebelum simpan</div>
            </div>
          )}
          {imageData && (
            <div style={{ display: "flex", gap: 10 }}>
              <img src={imageData} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
              {scanResult?.items?.length > 0 && (
                <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Item Dikesan</div>
                  {scanResult.items.map((it, i) => <div key={i} style={{ fontSize: 12, color: C.text }}>• {it}</div>)}
                </div>
              )}
            </div>
          )}
          <div style={{ background: C.card, border: `1px solid ${C.accent}44`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accentL, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><AppIcon name="edit" size={16} /> Sahkan Maklumat</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Penerangan / Merchant</div><input value={editForm.desc} onChange={e => setEditForm({...editForm, desc: e.target.value})} style={inp} /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Jumlah ({profile.currency})</div><input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} style={inp} /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Tarikh</div><input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} style={inp} /></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Kategori</div>
                  <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} style={inp}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Akaun</div>
                  <select value={editForm.account} onChange={e => setEditForm({...editForm, account: e.target.value})} style={inp}>
                    <option value="cash">Tunai</option>
                    <option value="maybank">Maybank</option>
                    <option value="cimb">CIMB</option>
                    <option value="tng">TnG</option>
                    <option value="grabpay">GrabPay</option>
                    <option value="card">Kad Kredit</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Btn onClick={confirmSave} style={{ flex: 2 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="check" size={16} /> Simpan Transaksi</span></Btn>
                <Btn variant="secondary" onClick={reset} style={{ flex: 1 }}>Batal</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "saved" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.green + "11", border: `1px solid ${C.green}44`, borderRadius: 20, padding: 32, textAlign: "center" }}>
            <IconBubble name="check" color={C.green} box={66} size={32} className="wk-float" style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: 20, fontWeight: 900, color: C.green, marginBottom: 6 }}>Berjaya Disimpan!</div>
            {editForm && (
              <div style={{ background: C.card, borderRadius: 12, padding: 14, textAlign: "left", marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: C.muted }}>Merchant</span><span style={{ fontSize: 13, fontWeight: 700 }}>{editForm.desc}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: C.muted }}>Jumlah</span><span style={{ fontSize: 15, fontWeight: 800, color: C.red }}>-{fmt(editForm.amount, profile.currency)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: C.muted }}>Tarikh</span><span style={{ fontSize: 13 }}>{editForm.date}</span></div>
              </div>
            )}
          </div>
          <Btn onClick={reset}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><AppIcon name="receipt" size={16} /> Simpan Resit Lain</span></Btn>
        </div>
      )}

      {selectedReceipt && (
        <div className="wk-modal" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div className="wk-modal-card" style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflow: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900 }}>Bukti Resit</div>
                <div style={{ fontSize: 11, color: C.muted }}>{selectedReceipt.desc} · {selectedReceipt.date}</div>
              </div>
              <button aria-label="Tutup bukti resit" onClick={() => setSelectedReceipt(null)} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontWeight: 900 }}>x</button>
            </div>
            {selectedReceipt.imageData ? (
              <img src={selectedReceipt.imageData} alt="Bukti resit" style={{ width: "100%", maxHeight: "68vh", objectFit: "contain", background: "#111", borderRadius: 12, border: `1px solid ${C.border}` }} />
            ) : (
              <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: 24, textAlign: "center", color: C.muted }}>
                Tiada gambar bukti untuk transaksi manual ini.
              </div>
            )}
            <div style={{ marginTop: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Jumlah</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: C.red }}>-{fmt(selectedReceipt.amount, profile.currency)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── REPORTS ───────────────────────────────────────────────
function Reports({ transactions, categories, profile }) {
  const inc = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const savRate = inc > 0 ? ((inc - exp) / inc * 100).toFixed(1) : 0;
  const catSpend = {};
  categories.forEach(c => { catSpend[c.id] = 0; });
  transactions.filter(t => t.type === "expense").forEach(t => { if (catSpend[t.category] !== undefined) catSpend[t.category] += t.amount; });
  const topCats = categories.map(c => ({ ...c, spent: catSpend[c.id] || 0 })).filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent);
  const totalSpent = topCats.reduce((s, c) => s + c.spent, 0);
  const donutR = 70; const circ = 2 * Math.PI * donutR;
  let off = 0;
  const slices = topCats.slice(0, 5).map(c => { const d = totalSpent > 0 ? (c.spent / totalSpent) * circ : 0; const s = { ...c, d, off }; off += d; return s; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[["Pendapatan", inc, C.green, "wallet"], ["Perbelanjaan", exp, C.red, "receipt"], ["Simpanan", inc - exp, C.accent, "target"], ["Kadar Simpan", savRate + "%", C.yellow, "chart"]].map(([l, v, col, icon]) => (
          <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name={icon} size={13} /> {l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{typeof v === "string" ? v : fmt(v, profile.currency)}</div>
          </div>
        ))}
      </div>

      {topCats.length > 0 ? (
        <>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Perbelanjaan Mengikut Kategori</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <svg className="wk-ring" width={160} height={160} viewBox="0 0 160 160">
                <circle cx={80} cy={80} r={donutR} fill="none" stroke={C.border} strokeWidth={18} />
                {slices.map((s, i) => (
                  <circle key={i} cx={80} cy={80} r={donutR} fill="none" stroke={s.color} strokeWidth={18}
                    strokeDasharray={`${s.d} ${circ - s.d}`} strokeDashoffset={-s.off + circ * 0.25} transform="rotate(-90 80 80)" />
                ))}
                <text x={80} y={76} textAnchor="middle" fill={C.text} fontSize={12} fontWeight={800}>{fmt(totalSpent, profile.currency).replace(profile.currency + " ", "")}</text>
                <text x={80} y={92} textAnchor="middle" fill={C.muted} fontSize={10}>{profile.currency} total</text>
              </svg>
              <div style={{ flex: 1 }}>
                {topCats.slice(0, 5).map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: c.color, marginRight: 8 }} />
                    <div style={{ fontSize: 12, flex: 1, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name={iconName(c.icon)} size={14} color={c.color} /> {c.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{pct(c.spent, totalSpent)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Analisis & Cadangan</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: C.green + "11", border: `1px solid ${C.green}33`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 12, color: C.green, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name="check" size={14} /> Kadar simpanan {savRate}% — {savRate >= (profile.savingsTarget || 20) ? "Tahniah! Melebihi sasaran!" : `Sasaran anda: ${profile.savingsTarget || 20}%`}</div>
              </div>
              {topCats[0] && <div style={{ background: C.yellow + "11", border: `1px solid ${C.yellow}33`, borderRadius: 10, padding: 10 }}><div style={{ fontSize: 12, color: C.yellow, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name="pin" size={14} /> Perbelanjaan tertinggi: {topCats[0].label} ({fmt(topCats[0].spent, profile.currency)})</div></div>}
              <div style={{ background: C.blue + "11", border: `1px solid ${C.blue}33`, borderRadius: 10, padding: 10 }}><div style={{ fontSize: 12, color: C.blue, display: "flex", alignItems: "center", gap: 6 }}><AppIcon name="chart" size={14} /> Nisbah belanja kepada pendapatan: {inc > 0 ? ((exp / inc) * 100).toFixed(1) : 0}%</div></div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: C.card, border: `2px dashed ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <IconBubble name="chart" color={C.dim} box={54} size={26} className="wk-float" style={{ margin: "0 auto 8px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Belum ada data untuk dianalisis</div>
          <div style={{ fontSize: 13, color: C.muted }}>Tambah transaksi untuk melihat laporan</div>
        </div>
      )}
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "home", labelKey: "main" },
  { id: "transactions", icon: "swap", labelKey: "transactions" },
  { id: "budget", icon: "wallet", labelKey: "budget" },
  { id: "goals", icon: "target", labelKey: "goals" },
  { id: "scanner", icon: "receipt", labelKey: "scanner" },
  { id: "reports", icon: "chart", labelKey: "reports" },
];

function authErrorMessage(err) {
  const code = err?.code || "";
  if (code === "auth/email-already-in-use") return "Email ini sudah didaftarkan. Tekan Login untuk masuk.";
  if (code === "auth/invalid-email") return "Format email tidak sah.";
  if (code === "auth/weak-password") return "Password terlalu lemah. Guna minimum 6 aksara.";
  if (code === "auth/user-not-found") return "Akaun belum didaftarkan. Tekan Create untuk buat akaun baru.";
  if (code === "auth/wrong-password") return "Password salah. Cuba semula.";
  if (code === "auth/invalid-credential") return "Akaun belum didaftarkan atau password salah. Tekan Create jika ini akaun baru.";
  if (code === "auth/network-request-failed") return "Masalah internet. Cuba semula.";
  return err?.message || "Gagal masuk akaun";
}

function AuthGate({ onPersonal, onEmailAuth, cloudStatus }) {
  const [mode, setMode] = useState("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (type) => {
    setError("");
    try {
      await onEmailAuth(type, email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text, maxWidth: 480, margin: "0 auto", padding: 20, display: "flex", alignItems: "center" }}>
      <style>{motionStyles("dark")}</style>
      <div className="wk-page" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <IconBubble name="wallet" color={C.accent} box={74} size={36} className="wk-float" style={{ margin: "0 auto 14px" }} />
          <div style={{ fontSize: 30, fontWeight: 900 }}><span style={{ color: C.accent }}>Wang</span>Ku</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>Pilih cara simpan data anda.</div>
        </div>

        {mode === "choice" ? (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <IconBubble name="user" color={C.blue} box={44} size={22} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>Personal Mode</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Data ikut device/browser ini sahaja.</div>
                </div>
              </div>
              <Btn onClick={onPersonal}>Guna Personal Mode</Btn>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <IconBubble name="globe" color={C.green} box={44} size={22} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>Sync Account</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Login akaun sedia ada, atau Create jika belum pernah daftar.</div>
                </div>
              </div>
              <Btn onClick={() => setMode("login")} variant="secondary">Login / Create Account</Btn>
            </div>
          </>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Email" placeholder="nama@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Password" type="password" placeholder="Minimum 6 aksara" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <div style={{ color: C.red, fontSize: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => submit("login")} style={{ flex: 1 }}>Login</Btn>
              <Btn onClick={() => submit("signup")} variant="secondary" style={{ flex: 1 }}>Create</Btn>
            </div>
            <Btn variant="ghost" onClick={() => setMode("choice")}>Balik</Btn>
          </div>
        )}

        <div style={{ textAlign: "center", color: C.dim, fontSize: 11 }}>{cloudStatus}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [setup, setSetup] = useState(() => store.get("setup_done", false));
  const [profile, setProfile] = useState(() => store.get("profile", DEFAULT_PROFILE));
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...store.get("prefs", DEFAULT_PREFS) }));
  const [categories, setCategories] = useState(() => store.get("categories", DEFAULT_CATEGORIES));
  const [transactions, setTransactions] = useState(() => store.get("transactions", []));
  const [goals, setGoals] = useState(() => store.get("goals", []));
  const [bills, setBills] = useState(() => store.get("bills", []));
  const [scannedReceipts, setScannedReceipts] = useState(() => store.get("scanned_receipts", []));
  const [page, setPage] = useState("dashboard");
  const [showNotif, setShowNotif] = useState(false);
  const [authChoice, setAuthChoice] = useState(() => store.get("auth_choice", IS_FIREBASE_ENABLED ? "" : "local"));
  const [cloudUser, setCloudUser] = useState(null);
  const [cloudLoaded, setCloudLoaded] = useState(!IS_FIREBASE_ENABLED);
  const [cloudStatus, setCloudStatus] = useState(IS_FIREBASE_ENABLED ? "Menyambung Firebase..." : "Mode Offline");
  const imageUploadCache = useRef(new Map());
  const applyingCloudData = useRef(false);
  C = PALETTES[prefs.theme] || PALETTES.dark;
  LANG = prefs.language || "ms";

  useEffect(() => {
    if (!IS_FIREBASE_ENABLED || !firebaseAuth) return;
    const unsub = onAuthStateChanged(firebaseAuth, user => {
      setCloudUser(user || null);
    });
    return unsub;
  }, []);

  const startPersonalMode = async () => {
    store.set("auth_choice", "personal");
    setAuthChoice("personal");
    if (IS_FIREBASE_ENABLED && firebaseAuth) {
      setCloudStatus("Menyambung Personal Mode...");
      await signInAnonymously(firebaseAuth);
    }
  };

  const handleEmailAuth = async (type, email, password) => {
    if (!firebaseAuth) throw new Error("Firebase belum dikonfigurasi");
    if (!email || password.length < 6) throw new Error("Masukkan email dan password minimum 6 aksara");
    setCloudStatus(type === "signup" ? "Membuat akaun..." : "Login...");
    try {
      if (type === "signup") await createUserWithEmailAndPassword(firebaseAuth, email, password);
      else await signInWithEmailAndPassword(firebaseAuth, email, password);
      store.set("auth_choice", "sync");
      setAuthChoice("sync");
    } catch (err) {
      store.set("auth_choice", "");
      setAuthChoice("");
      setCloudStatus("Login diperlukan");
      throw err;
    }
  };

  const handleSwitchAccount = async () => {
    store.set("auth_choice", "");
    setAuthChoice("");
    setCloudUser(null);
    setCloudLoaded(false);
    if (firebaseAuth) await signOut(firebaseAuth);
  };

  useEffect(() => {
    if (!IS_FIREBASE_ENABLED || !firebaseDb || !cloudUser) return;
    setCloudLoaded(false);
    setCloudStatus("Memuat data Firebase...");
    const refDoc = doc(firebaseDb, "users", cloudUser.uid, "wangku", "main");
    const unsub = onSnapshot(refDoc, snap => {
      applyingCloudData.current = true;
      try {
        if (snap.exists()) {
          const data = snap.data();
          setPrefs({ ...DEFAULT_PREFS, ...(data.prefs || {}) });
          setProfile({ ...DEFAULT_PROFILE, ...(data.profile || {}) });
          setCategories(data.categories?.length ? data.categories : DEFAULT_CATEGORIES);
          setTransactions(data.transactions || []);
          setGoals(data.goals || []);
          setBills(data.bills || []);
          setScannedReceipts(data.scannedReceipts || []);
          if (data.setupDone !== undefined) setSetup(Boolean(data.setupDone));
        }
        setCloudLoaded(true);
        setCloudStatus(snap.exists() ? "Firebase synced" : "Akaun sync baru — lengkapkan setup dahulu");
      } finally {
        setTimeout(() => { applyingCloudData.current = false; }, 300);
      }
    }, err => {
      applyingCloudData.current = false;
      setCloudLoaded(true);
      setCloudStatus(`Firebase load gagal: ${err.message}`);
    });
    return () => unsub();
  }, [cloudUser]);

  useEffect(() => {
    if (!IS_FIREBASE_ENABLED || !firebaseDb || !cloudUser || !cloudLoaded || applyingCloudData.current) return;
    const timer = setTimeout(async () => {
      if (applyingCloudData.current) return;
      try {
        setCloudStatus("Menyimpan ke Firebase...");
        const data = await prepareCloudData(cloudUser.uid, {
          setupDone: setup,
          prefs,
          profile,
          categories,
          transactions,
          goals,
          bills,
          scannedReceipts,
        }, imageUploadCache.current);
        await setDoc(doc(firebaseDb, "users", cloudUser.uid, "wangku", "main"), data, { merge: true });
        setCloudStatus("Firebase synced");
      } catch (err) {
        setCloudLoaded(true);
        setCloudStatus(`Firebase save gagal: ${err.message}`);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [setup, prefs, profile, categories, transactions, goals, bills, scannedReceipts, cloudUser, cloudLoaded]);

  // Auto-save everything to localStorage
  useEffect(() => { store.set("prefs", prefs); }, [prefs]);
  useEffect(() => { store.set("profile", profile); }, [profile]);
  useEffect(() => { store.set("categories", categories); }, [categories]);
  useEffect(() => { store.set("transactions", transactions); }, [transactions]);
  useEffect(() => { store.set("goals", goals); }, [goals]);
  useEffect(() => { store.set("bills", bills); }, [bills]);
  useEffect(() => { store.set("scanned_receipts", scannedReceipts); }, [scannedReceipts]);

  const handleSetupDone = (p, cats) => {
    setProfile(p); setCategories(cats);
    store.set("setup_done", true); setSetup(true);
  };

  const handleReset = () => {
    Object.keys(localStorage).filter(key => key.startsWith("wangku_")).forEach(key => localStorage.removeItem(key));
    setSetup(false); setProfile(DEFAULT_PROFILE);
    setPrefs(DEFAULT_PREFS);
    setCategories(DEFAULT_CATEGORIES); setTransactions([]); setGoals([]); setBills([]); setScannedReceipts([]);
    setPage("dashboard");
  };

  const today = new Date().getDate();
  const urgentBills = bills.filter(b => {
    const d = b.dueDay >= today ? b.dueDay - today : 31 + b.dueDay - today;
    return d <= 5;
  });
  const overBudgetCats = categories.filter(cat => {
    const spent = transactions.filter(t => t.type === "expense" && t.category === cat.id).reduce((s, t) => s + t.amount, 0);
    return cat.budget > 0 && spent > cat.budget;
  });
  const notifications = [
    ...overBudgetCats.map(c => ({ id: "b" + c.id, msg: `Budget ${c.label} telah melebihi had!`, color: C.red, icon: "alert" })),
    ...urgentBills.map(b => ({ id: "bi" + b.id, msg: `${b.name} perlu dibayar dalam ${b.dueDay >= today ? b.dueDay - today : 31 + b.dueDay - today} hari`, color: C.yellow, icon: "bell" })),
    ...goals.filter(g => pct(g.saved, g.target) >= 100).map(g => ({ id: "g" + g.id, msg: `Goal "${g.title}" telah tercapai!`, color: C.green, icon: "target" })),
  ];

  if (IS_FIREBASE_ENABLED && !authChoice) {
    return <AuthGate onPersonal={startPersonalMode} onEmailAuth={handleEmailAuth} cloudStatus={cloudStatus} />;
  }

  if (!setup) return <Onboarding onDone={handleSetupDone} />;

  const pageTitles = { dashboard: tx("dashboardTitle"), transactions: tx("transactions"), budget: tx("budget"), goals: tx("goals"), scanner: tx("scannerTitle"), reports: tx("reports"), settings: tx("settingsTitle") };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text, maxWidth: 480, margin: "0 auto", paddingBottom: 104 }}>
      <style>{motionStyles(prefs.theme)}</style>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: C.bg + "EE", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.border}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}><span style={{ color: C.accent }}>Wang</span><span style={{ color: C.text }}>Ku</span></div>
          <div style={{ fontSize: 10, color: C.muted }}>
            {new Date().toLocaleDateString("ms-MY", { month: "long", year: "numeric" })}
            {IS_FIREBASE_ENABLED && <span style={{ color: cloudStatus.includes("gagal") ? C.red : C.green }}> · {cloudStatus.includes("synced") ? "Synced" : "Cloud"}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button aria-label={tx("settingsTitle")} onClick={() => setPage("settings")} style={{ color: C.text, background: C.card, border: `1px solid ${page === "settings" ? C.accent : C.border}`, borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16 }}><AppIcon name="gear" size={18} /></button>
          <button aria-label={tx("notifications")} onClick={() => setShowNotif(!showNotif)} style={{ position: "relative", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16 }}>
            <AppIcon name="bell" size={18} color={C.text} />
            {notifications.length > 0 && <span style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, background: C.red, borderRadius: 99, border: `2px solid ${C.bg}` }} />}
          </button>
        </div>
      </div>

      {showNotif && (
        <div className="wk-modal-card" style={{ position: "fixed", top: 68, right: 10, left: 10, maxWidth: 460, margin: "0 auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, zIndex: 100, boxShadow: "0 16px 48px rgba(0,0,0,.6)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>{tx("notifications")}</div>
          {notifications.length === 0 ? (
            <div style={{ fontSize: 13, color: C.dim, padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}><AppIcon name="check" size={16} color={C.green} /> {tx("noNotifications")}</div>
          ) : notifications.map(n => (
            <div key={n.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
              <AppIcon name={n.icon} size={17} color={n.color} />
              <span style={{ fontSize: 13, color: n.color }}>{n.msg}</span>
            </div>
          ))}
          <button onClick={() => setShowNotif(false)} style={{ marginTop: 12, width: "100%", background: C.border, border: "none", borderRadius: 10, padding: "10px", color: C.muted, fontWeight: 700, cursor: "pointer" }}>{tx("close")}</button>
        </div>
      )}

      <div style={{ padding: "16px 18px 6px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{pageTitles[page]}</div>
        {page === "scanner" && <Badge color={C.accent}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AppIcon name="receipt" size={12} /> PWA</span></Badge>}
      </div>

      <div key={page} className="wk-page" style={{ padding: "10px 16px" }}>
        {page === "dashboard" && <Dashboard transactions={transactions} goals={goals} categories={categories} profile={profile} setPage={setPage} />}
        {page === "transactions" && <Transactions transactions={transactions} setTransactions={setTransactions} categories={categories} profile={profile} />}
        {page === "budget" && <Budget transactions={transactions} categories={categories} profile={profile} />}
        {page === "goals" && <Goals goals={goals} setGoals={setGoals} profile={profile} />}
        {page === "scanner" && <ReceiptScanner setTransactions={setTransactions} categories={categories} profile={profile} scannedReceipts={scannedReceipts} setScannedReceipts={setScannedReceipts} />}
        {page === "reports" && <Reports transactions={transactions} categories={categories} profile={profile} />}
        {page === "settings" && <Settings profile={profile} setProfile={setProfile} categories={categories} setCategories={setCategories} bills={bills} setBills={setBills} prefs={prefs} setPrefs={setPrefs} scannedReceipts={scannedReceipts} authChoice={authChoice} cloudStatus={cloudStatus} onSwitchAccount={handleSwitchAccount} onReset={handleReset} />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface + "F8", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, zIndex: 50 }}>
        <div style={{ display: "flex" }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} className={`wk-nav-button ${page === n.id ? "wk-nav-active" : ""}`} style={{ flex: 1, background: "none", border: "none", padding: "9px 2px 7px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ color: page === n.id ? C.accent : C.dim, opacity: page === n.id ? 1 : 0.55, transition: "all .2s" }}><AppIcon name={n.icon} size={18} /></span>
              <span style={{ fontSize: 8, fontWeight: 700, color: page === n.id ? C.accent : C.dim, textTransform: "uppercase", letterSpacing: .2 }}>{tx(n.labelKey)}</span>
              {page === n.id && <div className="wk-nav-dot" style={{ width: 4, height: 4, borderRadius: 99, background: C.accent, marginTop: -2 }} />}
            </button>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "4px 8px 6px", textAlign: "center", fontSize: 9, fontWeight: 700, letterSpacing: .3, color: C.dim }}>
          © WangKu 2026 by LUBUK IT
        </div>
      </div>
    </div>
  );
}
