import { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, FolderOpen, Network, Activity, Settings,
  Sun, Moon, Bell, Search, Plus, Download, Upload, X, Lock,
  FileText, Check, Eye, Clock, Shield, Tag, Move, Trash2,
  ChevronRight, ChevronDown, GitBranch, Globe, BookOpen,
  ArrowRight, MoreHorizontal, Zap, Command
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type View = "dash" | "vault" | "doc" | "graph" | "mon";
type DocTab = "pdf" | "word" | "diff" | "history";

// ─── Data ────────────────────────────────────────────────────────────────────
const VAULT_FOLDERS = [
  { name: "Nizomlar", count: 38, meta: "34 aktiv · Yuridik bo'lim", accent: true, locked: false },
  { name: "Buyruqlar", count: 51, meta: "47 aktiv · 2024–2026", accent: false, locked: false },
  { name: "Reglamentlar", count: 23, meta: "Kirish cheklangan · ACL", accent: false, locked: true },
  { name: "Siyosatlar", count: 14, meta: "12 aktiv · CBU bilan bog'liq", accent: false, locked: false },
];

const FAN_DATA = [
  { name: "Nizomlar", count: "38 hujjat", hot: false },
  { name: "Buyruqlar", count: "51 hujjat", hot: false },
  { name: "Kredit", count: "67 hujjat", hot: true },
  { name: "Reglamentlar", count: "23 hujjat", hot: false },
  { name: "Siyosatlar", count: "14 hujjat", hot: false },
  { name: "HR", count: "31 hujjat", hot: false },
  { name: "Moliyaviy", count: "45 hujjat", hot: false },
  { name: "Arxiv", count: "203 hujjat", hot: false },
];

const DOCS = [
  { id: 0, name: "Kredit berish tartibi to'g'risidagi Nizom", num: "N-12", author: "A. Karimov", tags: [{ l: "CBU", v: true }, { l: "kredit", v: false }], status: "active", ver: "v2.0", date: "15.03.2026", dept: "Kredit dep." },
  { id: 1, name: "Ichki nazorat reglamenti", num: "R-07", author: "Sh. Tosheva", tags: [{ l: "nazorat", v: false }], status: "active", ver: "v1.1", date: "02.02.2026", dept: "Yuridik" },
  { id: 2, name: "Axborot xavfsizligi siyosati", num: "S-03", author: "D. Rahimova", tags: [{ l: "IT", v: false }], status: "review", ver: "v3.0", date: "—", dept: "IT" },
  { id: 3, name: "Valyuta operatsiyalari yo'riqnomasi", num: "Y-21", author: "", tags: [{ l: "CBU", v: true }], status: "expired", ver: "v1.0", date: "11.06.2024", dept: "Moliyaviy" },
  { id: 4, name: "Xodimlarni rag'batlantirish nizomi", num: "N-19", author: "M. Aliyev", tags: [{ l: "HR", v: false }], status: "active", ver: "v1.0", date: "20.01.2026", dept: "HR" },
];

const GRAPH_NODES = [
  { id: "N-12", type: "nizom", label: "N-12 Kredit tartibi", big: true },
  { id: "N-08", type: "nizom", label: "N-08 Kredit qo'mitasi", big: false },
  { id: "R-07", type: "reg", label: "R-07 Ichki nazorat", big: false },
  { id: "S-03", type: "nizom", label: "S-03 Axb. xavfsizligi", big: false },
  { id: "Y-30", type: "buyruq", label: "Y-30 Yo'riqnoma", big: false },
  { id: "Y-21", type: "buyruq", label: "Y-21 Valyuta", big: false },
  { id: "B-44", type: "buyruq", label: "B-44 Buyruq", big: false },
  { id: "B-51", type: "buyruq", label: "B-51 Buyruq", big: false },
  { id: "CBU145", type: "ext", label: "CBU 145/2026", big: true },
  { id: "ORQ812", type: "ext", label: "Lex O'RQ-812", big: false },
  { id: "N-19", type: "nizom", label: "N-19 HR nizomi", big: false },
  { id: "R-11", type: "reg", label: "R-11 Reglament", big: false },
];

const GRAPH_LINKS: [string, string][] = [
  ["CBU145", "N-12"], ["CBU145", "N-08"], ["CBU145", "Y-30"],
  ["N-12", "N-08"], ["N-12", "Y-30"], ["ORQ812", "S-03"],
  ["ORQ812", "R-07"], ["R-07", "S-03"], ["N-12", "B-44"],
  ["N-08", "B-51"], ["N-19", "R-11"], ["R-07", "R-11"],
];

const NODE_COLOR: Record<string, string> = {
  nizom: "#C6F24E", buyruq: "#6BB4F5", reg: "#B39CF5", ext: "#F0C24B",
};

const CMDK_ITEMS = [
  { section: "Amallar", items: [
    { key: "yangi hujjat yuklash", icon: <Plus size={15} />, label: "Yangi hujjat yuklash", kbd: "N", action: "wiz" },
    { key: "yangi versiya shablon", icon: <FileText size={15} />, label: "Yangi versiya yaratish (shablon)", kbd: "V", action: "doc" },
    { key: "graf boglanish", icon: <Network size={15} />, label: "Grafni ochish", kbd: "G", action: "graph" },
  ]},
  { section: "Hujjatlar", items: [
    { key: "kredit berish tartibi n-12 nizom", icon: <FileText size={15} />, label: "Kredit berish tartibi to'g'risidagi Nizom", sub: "N-12 · Aktiv", action: "doc" },
    { key: "ichki nazorat reglamenti r-07", icon: <FileText size={15} />, label: "Ichki nazorat reglamenti", sub: "R-07 · Aktiv", action: "vault" },
    { key: "axborot xavfsizligi s-03", icon: <FileText size={15} />, label: "Axborot xavfsizligi siyosati", sub: "S-03 · Loyiha", action: "vault" },
    { key: "cbu 145 qaror tashqi akt", icon: <Activity size={15} />, label: "CBU qarori № 145/2026", sub: "Tashqi akt", action: "mon" },
  ]},
];

// ─── Helper Components ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const M: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    active:  { label: "Aktiv", bg: "rgba(198,242,78,.14)", text: "#C6F24E", dot: "#C6F24E" },
    review:  { label: "Ko'rib chiqilmoqda", bg: "rgba(240,194,75,.14)", text: "#F0C24B", dot: "#F0C24B" },
    expired: { label: "Kuchini yo'qotgan", bg: "rgba(140,150,155,.14)", text: "#8FA0A8", dot: "#8FA0A8" },
    draft:   { label: "Loyiha", bg: "rgba(240,122,107,.14)", text: "#F07A6B", dot: "#F07A6B" },
  };
  const s = M[status] || M.draft;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-[5px] rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.text }}>
      <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function TagBadge({ label, violet }: { label: string; violet?: boolean }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px] mr-1"
      style={{
        background: violet ? "rgba(179,156,245,.14)" : "rgba(107,180,245,.13)",
        color: violet ? "#B39CF5" : "#6BB4F5",
      }}>
      {label}
    </span>
  );
}

// ─── Folder Card (macOS stacked-sheets style) ────────────────────────────────
function FolderCard({ folder, onClick }: { folder: typeof VAULT_FOLDERS[0]; onClick: () => void }) {
  const { name, count, meta, accent, locked } = folder;
  return (
    <div onClick={onClick} className="relative cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
      style={{ borderRadius: 20, overflow: "visible" }}>
      {/* Tab notch at top */}
      <div className="absolute left-0 w-[44%] h-6 -translate-y-[10px]"
        style={{
          top: 0,
          borderRadius: "14px 18px 0 0",
          background: accent ? "rgba(198,242,78,.45)" : "rgba(255,255,255,.06)",
          border: accent ? "1px solid rgba(198,242,78,.55)" : "1px solid rgba(255,255,255,.10)",
          borderBottom: "none",
        }} />

      {/* Main card body */}
      <div className="relative" style={{
        paddingTop: 96, paddingBottom: 16, paddingLeft: 18, paddingRight: 18,
        borderRadius: 20,
        background: accent
          ? "linear-gradient(160deg, rgba(198,242,78,.4), rgba(47,164,91,.2))"
          : "rgba(255,255,255,.055)",
        border: accent ? "1px solid rgba(198,242,78,.45)" : "1px solid rgba(255,255,255,.09)",
        backdropFilter: "blur(16px)",
      }}>
        {/* Stacked paper sheets */}
        <div className="absolute top-[-2px] left-4 right-4 h-[88px]" style={{ zIndex: -1 }}>
          {[
            { cls: "left-[2%] rotate-[-5deg] translate-y-1.5", z: 0 },
            { cls: "left-[34%] -translate-y-0.5", z: 2 },
            { cls: "right-[2%] rotate-[5deg] translate-y-1.5", z: 0 },
          ].map((sheet, i) => (
            <div key={i} className={`absolute bottom-1.5 w-[31%] h-[74px] rounded-lg shadow-md ${sheet.cls}`}
              style={{ background: "#F4F7F5", zIndex: sheet.z, padding: "9px 8px" }}>
              {[85, 100, 60, 72].map((w, j) => (
                <span key={j} className="block h-[3.5px] rounded-sm mb-1"
                  style={{ width: `${w}%`, background: j === 0 ? "#AEBDB5" : "#C9D4CE" }} />
              ))}
            </div>
          ))}
        </div>

        {/* Count badge */}
        <span className="absolute top-3 right-3 text-[10.5px] font-bold px-2.5 py-1 rounded-full"
          style={{
            background: accent ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.06)",
            border: accent ? "none" : "1px solid rgba(255,255,255,.10)",
            color: accent ? "#0A1600" : "#8FA0A8",
            backdropFilter: "blur(8px)",
          }}>
          {count} hujjat
        </span>

        {locked && <Lock className="absolute top-3 left-4" size={13} style={{ color: "#8FA0A8" }} />}

        <p className="font-['Sora'] text-[15px] font-semibold mb-1"
          style={{ color: accent ? "#0A1600" : "#EDF3F0" }}>{name}</p>
        <p className="text-[11.5px] font-semibold flex items-center gap-1.5"
          style={{ color: accent ? "rgba(10,22,0,.65)" : "#8FA0A8" }}>
          <span className="w-[5px] h-[5px] rounded-full flex-shrink-0"
            style={{ background: accent ? "rgba(10,22,0,.4)" : "#C6F24E" }} />
          {meta}
        </p>
      </div>
    </div>
  );
}

// ─── Graph View ───────────────────────────────────────────────────────────────
function GraphView({ onNavigate }: { onNavigate: (v: View) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Array<{ id: string; type: string; label: string; big: boolean; x: number; y: number; vx: number; vy: number; r: number }>>([]);
  const hoverRef = useRef<string | null>(null);
  const frameRef = useRef<number>(0);
  const initRef = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const wrap = canvas.parentElement!;

    function resize() {
      canvas!.width = wrap.clientWidth * devicePixelRatio;
      canvas!.height = wrap.clientHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    if (!initRef.current) {
      initRef.current = true;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      nodesRef.current = GRAPH_NODES.map(n => ({
        ...n,
        x: W / 2 + (Math.random() - 0.5) * 320,
        y: H / 2 + (Math.random() - 0.5) * 260,
        vx: 0, vy: 0,
        r: n.big ? 14 : 9,
      }));
    }

    const byId = Object.fromEntries(nodesRef.current.map(n => [n.id, n]));

    function tick() {
      const nodes = nodesRef.current;
      const W = wrap.clientWidth, H = wrap.clientHeight;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const f = 1400 / (d * d);
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f;
          b.vx += dx * f; b.vy += dy * f;
        }
      }
      GRAPH_LINKS.forEach(([s, t]) => {
        const a = byId[s], b = byId[t];
        if (!a || !b) return;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d - 110) * 0.004;
        dx /= d; dy /= d;
        a.vx += dx * f * d; a.vy += dy * f * d;
        b.vx -= dx * f * d; b.vy -= dy * f * d;
      });
      nodes.forEach(n => {
        n.vx += (W / 2 - n.x) * 0.0012;
        n.vy += (H / 2 - n.y) * 0.0012;
        n.vx *= 0.86; n.vy *= 0.86;
        n.x += n.vx; n.y += n.vy;
      });

      ctx.clearRect(0, 0, W, H);
      const h = hoverRef.current;

      GRAPH_LINKS.forEach(([s, t]) => {
        const a = byId[s], b = byId[t];
        if (!a || !b) return;
        const lit = h && (h === s || h === t);
        ctx.strokeStyle = lit ? "rgba(198,242,78,.85)" : "rgba(255,255,255,.10)";
        ctx.lineWidth = lit ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });

      nodes.forEach(n => {
        const dim = h && h !== n.id && !GRAPH_LINKS.some(l => l.includes(h) && l.includes(n.id));
        ctx.globalAlpha = dim ? 0.2 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = NODE_COLOR[n.type];
        ctx.fill();
        if (n.id === h) {
          ctx.strokeStyle = NODE_COLOR[n.type];
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = "rgba(237,243,240,.88)";
        ctx.font = "700 10px Manrope";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + n.r + 15);
        ctx.globalAlpha = 1;
      });

      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const found = nodesRef.current.find(n => Math.hypot(n.x - mx, n.y - my) < n.r + 7);
    hoverRef.current = found?.id || null;
    canvasRef.current!.style.cursor = found ? "pointer" : "default";
  }

  function handleClick() {
    const h = hoverRef.current;
    setSelected(h);
  }

  const selNode = selected ? GRAPH_NODES.find(n => n.id === selected) : null;
  const selLinks = selected ? GRAPH_LINKS.filter(l => l.includes(selected)).length : 0;

  return (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: "#EDF3F0" }}>
            Bog'lanishlar grafi
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8FA0A8" }}>
            Hujjatlar orasidagi munosabatlar · nuqta ustiga boring, bosing
          </p>
        </div>
      </div>

      <div className="relative" style={{
        height: "calc(100vh - 230px)", minHeight: 480, borderRadius: 20,
        overflow: "hidden",
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.08)",
      }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }}
          onMouseMove={handleMouseMove} onClick={handleClick} />

        {/* Legend */}
        <div className="absolute top-3.5 left-3.5 text-[11.5px] font-bold space-y-1"
          style={{ background: "rgba(26,26,26,.9)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 14, padding: "12px 16px", backdropFilter: "blur(16px)" }}>
          {[["nizom", "Nizom"], ["buyruq", "Buyruq"], ["reg", "Reglament"], ["ext", "Tashqi akt (CBU/Lex)"]].map(([t, l]) => (
            <div key={t} className="flex items-center gap-2" style={{ color: "#8FA0A8" }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: NODE_COLOR[t] }} />
              {l}
            </div>
          ))}
        </div>

        {/* Selected node panel */}
        {selNode && (
          <div className="absolute top-3.5 right-3.5 w-60 text-sm"
            style={{ background: "rgba(26,26,26,.95)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 16, padding: 16, backdropFilter: "blur(18px)" }}>
            <p className="font-['Sora'] font-semibold mb-1" style={{ color: "#EDF3F0" }}>{selNode.label}</p>
            <p className="text-[11px] font-semibold mb-3" style={{ color: "#8FA0A8" }}>
              {selNode.type === "ext" ? "Tashqi akt · monitoring" : "Ichki hujjat"} · {selLinks} bog'lanish
            </p>
            <button onClick={() => onNavigate(selNode.type === "ext" ? "mon" : "doc")}
              className="w-full text-center text-[12.5px] font-bold py-2 rounded-xl transition-colors"
              style={{ background: "rgba(255,255,255,.07)", color: "#EDF3F0", border: "1px solid rgba(255,255,255,.09)" }}>
              Hujjatni ochish
            </button>
          </div>
        )}

        {/* Mode selector */}
        <div className="absolute bottom-3.5 left-3.5 flex gap-1 text-[11px] font-bold"
          style={{ background: "rgba(26,26,26,.9)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 12, padding: 4, backdropFilter: "blur(16px)" }}>
          {["Graf", "Workflow"].map((m, i) => (
            <span key={m} className="px-3 py-1.5 rounded-[9px] cursor-pointer"
              style={i === 0
                ? { background: "#C6F24E", color: "#0A1600" }
                : { color: "#8FA0A8" }}>
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [view, setView] = useState<View>("dash");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizOpen, setWizOpen] = useState(false);
  const [wizStep, setWizStep] = useState(1);
  const [docTab, setDocTab] = useState<DocTab>("pdf");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [cmdkQuery, setCmdkQuery] = useState("");
  const [vaultSeg, setVaultSeg] = useState<"table" | "card" | "timeline">("table");
  const [vaultFilter, setVaultFilter] = useState("Barchasi");
  const [monFilter, setMonFilter] = useState("Barchasi");
  const [treeOpen, setTreeOpen] = useState(true);
  const [pickedFiles, setPickedFiles] = useState<string[]>([]);
  const [treeExpanded, setTreeExpanded] = useState(true);

  const lime = isDark ? "#C6F24E" : "#2FA45B";
  const bg = isDark ? "#0D0D0D" : "#EFF2EE";
  const cardBg = isDark ? "#1A1A1A" : "#FFFFFF";
  const panel = isDark ? "rgba(255,255,255,.055)" : "rgba(255,255,255,.75)";
  const panelBorder = isDark ? "rgba(255,255,255,.09)" : "rgba(10,30,20,.09)";
  const txt = isDark ? "#EDF3F0" : "#0B1A16";
  const txt2 = isDark ? "#8FA0A8" : "#5C6E68";
  const txt3 = isDark ? "#5B6B74" : "#93A29C";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdkOpen(true); }
      if (e.key === "Escape") { setCmdkOpen(false); setDrawerOpen(false); setWizOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toast = useCallback((msg: string) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400);
  }, []);

  const goView = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };

  const toggleDoc = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () =>
    setSelected(selected.size === DOCS.length ? new Set() : new Set(DOCS.map(d => d.id)));

  // Breadcrumb map
  const crumbs: Record<View, string> = {
    dash: "Bosh sahifa",
    vault: "Vault / Yuridik bo'lim",
    doc: "Vault / Yuridik / N-12",
    graph: "Bog'lanishlar",
    mon: "Monitoring",
  };

  // Glass card style helper
  const glass = (extra?: string) => ({
    background: panel,
    border: `1px solid ${panelBorder}`,
    backdropFilter: "blur(16px)",
    borderRadius: 20,
    ...(extra ? {} : {}),
  } as React.CSSProperties);

  // ── Sidebar Rail ──────────────────────────────────────────────────────────
  const railItems: { id?: View; icon: React.ReactNode; pip?: boolean }[] = [
    { id: "dash", icon: <LayoutDashboard size={19} /> },
    { id: "vault", icon: <FolderOpen size={19} /> },
    { id: "graph", icon: <Network size={19} /> },
    { id: "mon", icon: <Activity size={19} />, pip: true },
    { icon: <GitBranch size={19} /> },
  ];

  const Rail = (
    <aside style={{
      width: 68, background: panel, backdropFilter: "blur(18px)",
      borderRight: `1px solid ${panelBorder}`,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "18px 0", gap: 8, position: "sticky", top: 0, height: "100vh", zIndex: 20, flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        width: 38, height: 38, borderRadius: 12, background: lime,
        display: "grid", placeItems: "center", marginBottom: 18,
        boxShadow: `0 6px 18px ${lime}55`,
      }}>
        <FolderOpen size={18} color="#0A1600" />
      </div>

      {railItems.map((item, i) => {
        const isActive = item.id && view === item.id;
        return (
          <div key={i} onClick={() => item.id && goView(item.id)}
            className="relative"
            style={{
              width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center",
              cursor: "pointer", transition: ".2s",
              background: isActive ? `${lime}22` : "transparent",
              color: isActive ? lime : txt2,
            }}>
            {item.pip && <span className="absolute top-2 right-2 w-[7px] h-[7px] rounded-full" style={{ background: "#F07A6B", border: `2px solid ${bg}` }} />}
            {item.icon}
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      <div onClick={() => setIsDark(d => !d)} style={{
        width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center",
        cursor: "pointer", color: txt2, transition: ".2s",
      }}>
        {isDark ? <Sun size={19} /> : <Moon size={19} />}
      </div>
      <div style={{
        width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center",
        cursor: "pointer", color: txt2,
      }}>
        <Settings size={19} />
      </div>
    </aside>
  );

  // ── Tree Sidebar ──────────────────────────────────────────────────────────
  const TreeSidebar = (
    <aside className="hidden md:block" style={{
      width: 242, background: panel, backdropFilter: "blur(18px)",
      borderRight: `1px solid ${panelBorder}`,
      padding: "20px 14px", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0,
    }}>
      <p className="text-[12.5px] font-semibold uppercase tracking-wide mb-2.5 px-2 mt-0" style={{ color: txt3, letterSpacing: ".4px" }}>Papkalar</p>

      {[
        { label: "Boshqaruv", count: 24, id: "boshqaruv" },
        { label: "Yuridik bo'lim", count: 112, id: "yuridik", active: true, expandable: true },
        { label: "Kredit dep.", count: 67, id: "kredit" },
        { label: "Moliyaviy bo'lim", count: null, id: "mol", locked: true },
        { label: "HR", count: 31, id: "hr" },
        { label: "Arxiv", count: 203, id: "arxiv" },
      ].map(node => (
        <div key={node.id}>
          <div onClick={() => { if (node.expandable) setTreeExpanded(e => !e); goView("vault"); }}
            style={{
              display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
              borderRadius: 11, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              transition: ".15s",
              background: node.active ? `${lime}18` : "transparent",
              color: node.active ? lime : txt2,
            }}>
            <FolderOpen size={15} />
            <span style={{ flex: 1 }}>{node.label}</span>
            {node.locked ? <Lock size={12} style={{ color: txt3 }} /> :
              node.count !== null ? <span className="text-[11px] font-bold" style={{ color: txt3 }}>{node.count}</span> : null}
            {node.expandable && (treeExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
          </div>
          {node.expandable && treeExpanded && (
            <div style={{ marginLeft: 20, borderLeft: `1.5px solid ${panelBorder}`, paddingLeft: 6 }}>
              {[["Nizomlar", 38], ["Buyruqlar", 51], ["Reglamentlar", 23]].map(([n, c]) => (
                <div key={n} style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "7px 10px",
                  borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: "pointer", color: txt2,
                }}>
                  <span style={{ flex: 1 }}>{n}</span>
                  <span className="text-[11px] font-bold" style={{ color: txt3 }}>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <p className="text-[12.5px] font-semibold uppercase tracking-wide mt-4 mb-2.5 px-2" style={{ color: txt3, letterSpacing: ".4px" }}>Saqlangan filtrlar</p>
      {[
        { color: "#B39CF5", label: "Yuridik · 2026 · aktivlar" },
        { color: "#6BB4F5", label: "CBU'ga bog'liq hujjatlar" },
      ].map(f => (
        <div key={f.label} style={{
          display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "7px 10px",
          borderRadius: 10, fontWeight: 700, cursor: "pointer", color: txt2,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: f.color, flexShrink: 0 }} />
          {f.label}
        </div>
      ))}
    </aside>
  );

  // ── Top Bar ───────────────────────────────────────────────────────────────
  const TopBar = (
    <div className="flex items-center gap-3 mb-6 flex-wrap"
      style={{ padding: "12px 16px", background: panel, backdropFilter: "blur(20px)", borderRadius: 999, border: `1px solid ${panelBorder}` }}>
      <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: txt3 }}>
        {crumbs[view].includes("/")
          ? <>{crumbs[view].split("/").slice(0, -1).join(" / ")} / <strong style={{ color: txt }}>{crumbs[view].split("/").pop()?.trim()}</strong></>
          : <strong style={{ color: txt }}>{crumbs[view]}</strong>}
      </span>

      <div onClick={() => setCmdkOpen(true)}
        className="flex items-center gap-2.5 cursor-text transition-all flex-1"
        style={{
          maxWidth: 440, background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)",
          border: `1px solid ${panelBorder}`, borderRadius: 999, padding: "9px 16px", color: txt3, fontSize: 13,
        }}>
        <Search size={14} />
        <span className="flex-1">Qidirish: nom, raqam yoki ma'no bo'yicha...</span>
        <kbd className="text-[10px] font-bold px-1.5 py-0.5 rounded-[5px]"
          style={{ border: `1px solid ${panelBorder}`, color: txt3 }}>⌘K</kbd>
      </div>

      <button onClick={() => setDrawerOpen(true)}
        className="relative flex items-center gap-2 font-bold text-[12.5px] transition-all cursor-pointer"
        style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 13, padding: "9px 14px", color: txt2 }}>
        <span className="absolute top-[7px] right-[9px] w-[7px] h-[7px] rounded-full" style={{ background: "#F07A6B" }} />
        <Bell size={16} />
      </button>

      <button onClick={() => setWizOpen(true)}
        className="flex items-center gap-2 font-bold text-[12.5px] cursor-pointer transition-all"
        style={{ background: lime, color: "#0A1600", border: "none", borderRadius: 13, padding: "9px 14px", boxShadow: `0 8px 22px ${lime}44` }}>
        <Plus size={15} /> Yangi hujjat
      </button>

      <div className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-[13px] cursor-pointer flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${lime}, #2FA45B)`, color: "#0A1600" }}>
        AK
      </div>
    </div>
  );

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  const Dashboard = (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: txt }}>
            Xush kelibsiz, Akmal
          </h1>
          <p className="text-sm mt-1" style={{ color: txt2 }}>
            Bugun: 2 ta yangi tashqi akt, 1 hujjat tasdiq kutmoqda
          </p>
        </div>
      </div>

      {/* Fan visualization */}
      <div className="relative mb-6 overflow-hidden" style={{ height: 220, borderRadius: 20, background: isDark ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}` }}>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 text-[11.5px] font-bold whitespace-nowrap"
          style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: "7px 14px", backdropFilter: "blur(14px)", color: txt2 }}>
          Jami <strong style={{ color: lime }}>482 hujjat</strong> · 14 papka
        </div>
        <div className="absolute inset-x-0 bottom-4 flex items-end justify-center gap-[-20px]"
          style={{ paddingLeft: 32, paddingRight: 32 }}>
          {FAN_DATA.map((f, i) => (
            <div key={i} onClick={() => goView("vault")} className="cursor-pointer group transition-all duration-300 hover:-translate-y-4 hover:z-20 relative"
              style={{
                width: 140, height: 160, borderRadius: 14, marginLeft: i === 0 ? 0 : -42, zIndex: i,
                transform: `rotate(${(i - FAN_DATA.length / 2) * 2.5}deg)`,
                background: f.hot
                  ? "linear-gradient(165deg, rgba(198,242,78,.55), rgba(47,164,91,.28))"
                  : isDark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.9)",
                border: f.hot ? "1px solid rgba(198,242,78,.55)" : `1px solid ${panelBorder}`,
                backdropFilter: "blur(10px)",
                boxShadow: "0 16px 40px rgba(0,0,0,.35)",
                padding: "14px 13px",
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
              }}>
              {/* Paper stubs */}
              <div className="absolute top-0 left-3 right-3 flex gap-1 justify-center" style={{ height: 56 }}>
                {[0, 1, 2].map(j => (
                  <div key={j} className="rounded w-[30%] h-[48px] shadow-sm"
                    style={{
                      background: "#F4F7F5",
                      transform: `rotate(${(j - 1) * 5}deg) translateY(${j === 1 ? -2 : 4}px)`,
                    }} />
                ))}
              </div>
              <p className="font-['Sora'] text-[13px] font-semibold" style={{ color: f.hot ? "#fff" : txt }}>{f.name}</p>
              <p className="text-[10.5px] font-bold" style={{ color: f.hot ? "rgba(255,255,255,.75)" : txt2 }}>{f.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards grid */}
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {[
          { label: "Aktiv hujjatlar", num: "396", sub: "+12 shu oyda", dotColor: lime, subAccent: true },
          { label: "Tasdiq kutmoqda", num: "7", sub: "3 tasi 5 kundan oshdi", dotColor: "#F0C24B" },
          { label: "Yangi tashqi aktlar", num: "2", sub: "cbu.uz · lex.uz, bugun", dotColor: "#6BB4F5" },
          { label: "Tekshirish tavsiya", num: "4", sub: "yangi aktlarga aloqador", dotColor: "#F07A6B" },
        ].map((stat, i) => (
          <div key={i} style={{ ...glass(), padding: "18px 20px" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: stat.dotColor }} />
              <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: txt3 }}>{stat.label}</span>
            </div>
            <p className="font-['Sora'] text-[28px] font-semibold tracking-tight" style={{ color: txt }}>{stat.num}</p>
            <p className="text-[11.5px] font-semibold mt-1" style={{ color: txt2 }}>
              {stat.subAccent ? <><strong style={{ color: lime }}>+12</strong> shu oyda</> : stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Activity + Attention 2-col */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        {/* Activity feed */}
        <div style={{ ...glass(), padding: "20px 22px" }}>
          <h2 className="font-['Sora'] text-[15px] font-semibold mb-4" style={{ color: txt }}>Oxirgi faollik</h2>
          {[
            { icon: <Plus size={15} />, iconBg: `${lime}22`, iconColor: lime, bold: "Kredit berish tartibi N-12", rest: " — v2.0 yangi versiya", who: "A. Karimov · taqqoslama biriktirildi", when: "12 daq" },
            { icon: <Activity size={15} />, iconBg: "rgba(107,180,245,.13)", iconColor: "#6BB4F5", bold: "CBU qarori № 145/2026", rest: " aniqlandi", who: "Monitoring · 4 aloqador ichki hujjat", when: "1 soat" },
            { icon: <Clock size={15} />, iconBg: "rgba(240,194,75,.13)", iconColor: "#F0C24B", bold: "Axborot xavfsizligi siyosati S-03", rest: " tasdiq kutmoqda", who: "D. Rahimova yubordi · 6 kun", when: "kecha" },
            { icon: <Check size={15} />, iconBg: `${lime}22`, iconColor: lime, bold: "Ichki nazorat reglamenti R-07", rest: " tasdiqlandi", who: "Sh. Tosheva · ACTIVE holatga o'tdi", when: "kecha" },
          ].map((row, i) => (
            <div key={i} className="flex gap-3 py-2.5 items-start" style={{ borderBottom: i < 3 ? `1px solid ${panelBorder}` : "none", fontSize: 12.5 }}>
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ background: row.iconBg, color: row.iconColor }}>
                {row.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p style={{ color: txt }}><strong>{row.bold}</strong>{row.rest}</p>
                <p className="mt-0.5 font-semibold" style={{ color: txt2 }}>{row.who}</p>
              </div>
              <span className="text-[11px] font-bold whitespace-nowrap flex-shrink-0" style={{ color: txt3 }}>{row.when}</span>
            </div>
          ))}
        </div>

        {/* Attention cards */}
        <div style={{ ...glass(), padding: "20px 22px" }}>
          <h2 className="font-['Sora'] text-[15px] font-semibold mb-4" style={{ color: txt }}>E'tibor talab qiladi</h2>
          {[
            { warn: true, title: "Lex.uz: yangi qonun O'RQ-812", body: '"Elektron hujjat aylanishi to\'g\'risida"gi qonunga o\'zgartirishlar. 3 ta ichki hujjat bilan yuqori o\'xshashlik.', go: "Monitoring'da ochish →", goAction: () => goView("mon") },
            { warn: false, title: "Taqqoslama shablon tayyor", body: "N-12 v2.0 uchun avtomatik shablon generatsiya qilindi — yuklab olib to'ldirishingiz mumkin.", go: "Yuklab olish →", goAction: () => toast("Shablon yuklab olinmoqda...") },
          ].map((notif, i) => (
            <div key={i} className="rounded-[13px] mb-2.5 text-[12.5px]"
              style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}`, padding: "12px 14px" }}>
              <p className="flex items-center gap-2 font-bold mb-1" style={{ color: txt }}>
                <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: notif.warn ? "#F0C24B" : lime }} />
                {notif.title}
              </p>
              <p className="font-semibold leading-relaxed" style={{ color: txt2 }}>{notif.body}</p>
              <span onClick={notif.goAction} className="inline-block mt-2 text-[11px] font-extrabold cursor-pointer" style={{ color: lime }}>
                {notif.go}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── VAULT ─────────────────────────────────────────────────────────────────
  const Vault = (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: txt }}>Yuridik bo'lim</h1>
          <p className="text-sm mt-1" style={{ color: txt2 }}>112 hujjat · 96 aktiv · oxirgi yangilanish bugun</p>
        </div>
        <div className="flex p-1 gap-0.5" style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 10 }}>
          {["Jadval", "Kartochka", "Timeline"].map(s => (
            <span key={s} onClick={() => setVaultSeg(s === "Jadval" ? "table" : s === "Kartochka" ? "card" : "timeline")}
              className="text-[11px] font-extrabold px-3 py-[5px] rounded-lg cursor-pointer"
              style={vaultSeg === (s === "Jadval" ? "table" : s === "Kartochka" ? "card" : "timeline")
                ? { background: isDark ? "rgba(255,255,255,.12)" : "#fff", color: txt }
                : { color: txt3 }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        {["Barchasi", "Aktiv", "Kuchini yo'qotgan", "Loyiha", "2026", "2025", "Nizom", "Buyruq", "Teg: CBU"].map(c => (
          <button key={c} onClick={() => setVaultFilter(c)}
            className="text-[12px] font-bold px-3.5 py-1.5 rounded-full cursor-pointer transition-all"
            style={vaultFilter === c
              ? { background: `${lime}22`, border: `1px solid ${lime}55`, color: lime }
              : { background: panel, border: `1px solid ${panelBorder}`, color: txt2, backdropFilter: "blur(10px)" }}>
            {c}
          </button>
        ))}
      </div>

      {/* Folder grid */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {VAULT_FOLDERS.map(f => <FolderCard key={f.name} folder={f} onClick={() => goView("vault")} />)}
      </div>

      {/* Document table */}
      <div style={{ ...glass() }}>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-['Sora'] text-[15px] font-semibold" style={{ color: txt }}>Hujjatlar</h2>
          <span className="text-[11.5px] font-bold" style={{ color: txt3 }}>Saralash: tasdiqlangan sana ↓</span>
        </div>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: "11px 12px 11px 22px", borderBottom: `1px solid ${panelBorder}`, textAlign: "left" }}>
                  <span onClick={toggleAll} className="w-4 h-4 rounded-[5px] inline-grid place-items-center cursor-pointer"
                    style={{ border: `1.5px solid ${txt3}`, background: selected.size === DOCS.length ? lime : "transparent" }}>
                    {selected.size === DOCS.length && <Check size={10} color="#0A1600" />}
                  </span>
                </th>
                {["Hujjat", "Teglar", "Holat", "Versiya", "Tasdiqlangan", "Bo'lim"].map(h => (
                  <th key={h} style={{ padding: "11px 18px", borderBottom: `1px solid ${panelBorder}`, textAlign: "left", fontSize: 10.5, fontWeight: 800, letterSpacing: ".7px", textTransform: "uppercase", color: txt3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOCS.map(doc => (
                <tr key={doc.id} onClick={() => goView("doc")} className="cursor-pointer" style={{ transition: ".15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "13px 12px 13px 22px" }} onClick={e => { e.stopPropagation(); toggleDoc(doc.id); }}>
                    <span className="w-4 h-4 rounded-[5px] inline-grid place-items-center cursor-pointer"
                      style={{ border: `1.5px solid ${selected.has(doc.id) ? lime : txt3}`, background: selected.has(doc.id) ? lime : "transparent" }}>
                      {selected.has(doc.id) && <Check size={10} color="#0A1600" />}
                    </span>
                  </td>
                  <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}`, color: txt, fontWeight: 700 }}>
                    {doc.name}
                    <span className="block text-[11px] font-semibold mt-0.5" style={{ color: txt3 }}>
                      № {doc.num}{doc.author ? ` · ${doc.author}` : ""}
                    </span>
                  </td>
                  <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}` }}>
                    {doc.tags.map(t => <TagBadge key={t.l} label={t.l} violet={t.v} />)}
                  </td>
                  <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}` }}>
                    <StatusBadge status={doc.status} />
                  </td>
                  <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}` }}>
                    <span className="text-[11px] font-extrabold px-2 py-1 rounded-[7px]"
                      style={{ border: `1px solid ${panelBorder}`, color: txt3 }}>{doc.ver}</span>
                  </td>
                  <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}`, color: txt2, fontWeight: 600 }}>{doc.date}</td>
                  <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}`, color: txt2, fontWeight: 600 }}>{doc.dept}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── DOCUMENT DETAIL ───────────────────────────────────────────────────────
  const DocDetail = (
    <div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 316px" }}>
        {/* Main card */}
        <div style={glass()}>
          {/* Header */}
          <div className="flex gap-4 items-start flex-wrap p-6">
            {/* PDF icon */}
            <div className="rounded-xl shadow-lg flex-shrink-0 relative overflow-hidden"
              style={{ width: 56, height: 66, background: "#F4F7F5", padding: "10px 9px" }}>
              {[80, 100, 55, 72].map((w, i) => (
                <span key={i} className="block h-1 rounded-sm mb-1" style={{ width: `${w}%`, background: i === 0 ? "#AEBDB5" : "#C9D4CE" }} />
              ))}
              <span className="absolute bottom-1.5 left-2 text-[8.5px] font-extrabold font-['Sora']" style={{ color: "#2FA45B" }}>PDF</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-['Sora'] text-[19px] font-semibold tracking-tight mb-1.5" style={{ color: txt }}>
                Kredit berish tartibi to'g'risidagi Nizom
              </h1>
              <div className="flex flex-wrap gap-3 items-center text-[12px] font-semibold" style={{ color: txt2 }}>
                <span>№ N-12</span><span>Tasdiqlangan: 15.03.2026</span><span>A. Karimov</span><span>Kredit departamenti</span>
                <StatusBadge status="active" /><TagBadge label="CBU" violet /><TagBadge label="kredit" />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
                style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
                <Download size={14} /> Yuklab olish
              </button>
              <button className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
                style={{ background: lime, color: "#0A1600", border: "none", boxShadow: `0 6px 18px ${lime}44` }}>
                <Plus size={14} /> Yangi versiya
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 overflow-x-auto" style={{ borderBottom: `1px solid ${panelBorder}` }}>
            {(["pdf", "word", "diff", "history"] as DocTab[]).map(t => {
              const labels: Record<DocTab, string> = { pdf: "PDF", word: "Word", diff: "Taqqoslama v1.1→v2.0", history: "Tarix" };
              return (
                <div key={t} onClick={() => setDocTab(t)}
                  className="px-4 py-3 text-[13px] font-bold cursor-pointer whitespace-nowrap"
                  style={{
                    color: docTab === t ? lime : txt3,
                    borderBottom: `2px solid ${docTab === t ? lime : "transparent"}`,
                  }}>
                  {labels[t]}
                </div>
              );
            })}
          </div>

          {/* PDF preview */}
          {docTab !== "diff" && (
            <div className="mx-6 my-5 rounded-xl shadow-xl p-8 min-h-[280px]"
              style={{ background: "#F4F7F5" }}>
              <div className="mb-5 h-3 rounded-full" style={{ width: "55%", background: "#B7C6BE" }} />
              {[88, 100, 70, 92, 64, 80, 100, 75].map((w, i) => (
                <div key={i} className="h-[6px] rounded-full mb-3" style={{ width: `${w}%`, background: "#D8E1DC" }} />
              ))}
            </div>
          )}

          {/* Diff view */}
          {docTab === "diff" && (
            <div className="mx-6 my-5">
              <div className="flex gap-2.5 items-center mb-3 text-[12px] font-bold" style={{ color: txt2 }}>
                <span className="px-2 py-1 rounded-[7px] text-[11px] font-extrabold" style={{ border: `1px solid ${panelBorder}`, color: txt3 }}>v1.1 · 20.08.2025</span>
                <ArrowRight size={14} style={{ color: txt3 }} />
                <span className="px-2 py-1 rounded-[7px] text-[11px] font-extrabold" style={{ border: `1px solid ${lime}`, color: lime }}>v2.0 · 15.03.2026</span>
                <StatusBadge status="active" />
                <span className="ml-auto text-[11px]" style={{ color: txt3 }}>2 band o'zgargan · 4 o'zgarishsiz</span>
              </div>
              <div className="overflow-hidden rounded-xl text-[12.5px]" style={{ border: `1px solid ${panelBorder}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)" }}>
                      {["№", "Eski tahrir", "Yangi tahrir"].map(h => (
                        <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 800, letterSpacing: ".6px", textTransform: "uppercase", color: txt3 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "12px 16px", color: txt3, fontWeight: 800, width: "5%" }}>1</td>
                      <td style={{ padding: "12px 16px", color: txt3, lineHeight: 1.55, width: "47.5%" }}>1.1. Ushbu Nizom korxonada kredit berish tartibini, kredit qo'mitasi vakolatlarini belgilaydi.</td>
                      <td style={{ padding: "12px 16px", color: txt3, lineHeight: 1.55 }}>— o'zgarishsiz —</td>
                    </tr>
                    <tr style={{ background: isDark ? "rgba(240,194,75,.05)" : "rgba(240,194,75,.06)" }}>
                      <td style={{ padding: "12px 16px", color: "#F0C24B", fontWeight: 800 }}>2</td>
                      <td style={{ padding: "12px 16px", color: txt2, lineHeight: 1.55 }}>
                        2.1. Kredit arizasi yozma shaklda qabul qilinadi va <del style={{ color: "#F07A6B", textDecoration: "line-through" }}>10 (o'n) ish kuni</del> ichida ko'rib chiqiladi.
                      </td>
                      <td style={{ padding: "12px 16px", lineHeight: 1.55, background: isDark ? `${lime}12` : `${lime}18` }}>
                        <span style={{ color: txt2 }}>2.1. Kredit arizasi yozma yoki elektron shaklda qabul qilinadi va </span>
                        <ins style={{ color: lime, textDecoration: "none", fontWeight: 700 }}>5 (besh) ish kuni</ins>
                        <span style={{ color: txt2 }}> ichida ko'rib chiqiladi.</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "12px 16px", color: txt3, fontWeight: 800 }}>3</td>
                      <td style={{ padding: "12px 16px", color: txt3, lineHeight: 1.55 }}>2.2. Kredit qo'mitasi haftada bir marta yig'iladi va qarorlar oddiy ko'pchilik ovoz bilan qabul qilinadi.</td>
                      <td style={{ padding: "12px 16px", color: txt3, lineHeight: 1.55 }}>— o'zgarishsiz —</td>
                    </tr>
                    <tr style={{ background: isDark ? "rgba(240,194,75,.05)" : "rgba(240,194,75,.06)" }}>
                      <td style={{ padding: "12px 16px", color: "#F0C24B", fontWeight: 800 }}>4</td>
                      <td style={{ padding: "12px 16px", color: txt2, lineHeight: 1.55 }}>
                        3.2. Ta'minot sifatida <del style={{ color: "#F07A6B", textDecoration: "line-through" }}>ko'chmas mulk yoki transport vositasi</del> qabul qilinadi.
                      </td>
                      <td style={{ padding: "12px 16px", lineHeight: 1.55, background: isDark ? `${lime}12` : `${lime}18` }}>
                        <span style={{ color: txt2 }}>3.2. Ta'minot sifatida ko'chmas mulk, transport vositasi </span>
                        <ins style={{ color: lime, textDecoration: "none", fontWeight: 700 }}>yoki bank kafolati (CBU № 145/2026 talablariga muvofiq)</ins>
                        <span style={{ color: txt2 }}> qabul qilinadi.</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Versions */}
          <div style={{ ...glass(), padding: 20 }}>
            <h3 className="font-['Sora'] text-[13px] font-semibold flex justify-between items-center mb-3.5" style={{ color: txt }}>
              Versiyalar <span className="text-[11px] font-extrabold cursor-pointer" style={{ color: lime, fontFamily: "Manrope" }}>+ Yangi versiya</span>
            </h3>
            {[
              { v: "v2.0 — joriy", when: "15.03.2026 · A. Karimov", files: ["PDF", "DOCX", "Taqqoslama"], cur: true },
              { v: "v1.1", when: "20.08.2025 · o'zgartirish, 2.1-band", files: ["PDF", "DOCX", "Taqqoslama"], cur: false },
              { v: "v1.0", when: "15.03.2024 · dastlabki tahrir", files: ["PDF", "DOCX"], cur: false },
            ].map((item, i, arr) => (
              <div key={i} className="flex gap-3 relative" style={{ paddingBottom: i < arr.length - 1 ? 18 : 0 }}>
                {i < arr.length - 1 && <div className="absolute left-[7px] top-[18px] bottom-0 w-[1.5px]" style={{ background: panelBorder }} />}
                <div className="w-[15px] h-[15px] rounded-full border-2 flex-shrink-0 mt-0.5"
                  style={{
                    borderColor: item.cur ? lime : txt3,
                    background: item.cur ? lime : bg,
                    boxShadow: item.cur ? `0 0 0 4px ${lime}22` : "none",
                  }} />
                <div>
                  <p className="text-[13px] font-bold" style={{ color: txt }}>{item.v}</p>
                  <p className="text-[11px] font-semibold mt-0.5 leading-relaxed" style={{ color: txt3 }}>{item.when}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {item.files.map(f => (
                      <span key={f} className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-[6px] cursor-pointer hover:text-primary"
                        style={{ border: `1px solid ${panelBorder}`, color: txt2 }}>{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Relations */}
          <div style={{ ...glass(), padding: 20 }}>
            <h3 className="font-['Sora'] text-[13px] font-semibold flex justify-between items-center mb-3.5" style={{ color: txt }}>
              Bog'lanishlar <span className="text-[11px] font-extrabold cursor-pointer" style={{ color: lime, fontFamily: "Manrope" }}>+ Qo'shish</span>
            </h3>
            {[
              { type: "asos", typeColor: lime, typeBg: `${lime}18`, label: "CBU qarori № 145/2026" },
              { type: "bola", typeColor: "#6BB4F5", typeBg: "rgba(107,180,245,.15)", label: "Kredit qo'mitasi yo'riqnomasi Y-30" },
              { type: "o'zgartiradi", typeColor: "#F0C24B", typeBg: "rgba(240,194,75,.15)", label: "Kredit qo'mitasi nizomi N-08" },
              { type: "o'rnini bosadi", typeColor: "#F07A6B", typeBg: "rgba(240,122,107,.15)", label: "Eski tartib N-05 (2022)" },
            ].map((rel, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 text-[12.5px] font-semibold" style={{ color: txt2 }}>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-[6px] flex-shrink-0 whitespace-nowrap"
                  style={{ background: rel.typeBg, color: rel.typeColor }}>{rel.type}</span>
                {rel.label}
              </div>
            ))}
          </div>

          {/* Audit */}
          <div style={{ ...glass(), padding: 20 }}>
            <h3 className="font-['Sora'] text-[13px] font-semibold mb-3.5" style={{ color: txt }}>Audit</h3>
            {[
              { action: "A. Karimov v2.0 yukladi", when: "bugun 11:42" },
              { action: "S. Nazarov PDF yuklab oldi", when: "bugun 09:15" },
              { action: "Sh. Tosheva ochib ko'rdi", when: "kecha" },
            ].map((a, i, arr) => (
              <div key={i} className="flex justify-between gap-2.5 py-1.5 text-[11.5px] font-semibold"
                style={{ borderBottom: i < arr.length - 1 ? `1px dashed ${panelBorder}` : "none", color: txt2 }}>
                <span>{a.action}</span>
                <span className="flex-shrink-0" style={{ color: txt3 }}>{a.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── MONITORING ────────────────────────────────────────────────────────────
  const Monitoring = (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: txt }}>Tashqi aktlar monitoringi</h1>
          <p className="text-sm mt-1" style={{ color: txt2 }}>cbu.uz va lex.uz · har 2 soatda tekshiriladi · oxirgi skan: 14:00</p>
        </div>
        <button className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
          style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
          <Settings size={14} /> Manba sozlamalari
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {["Barchasi", "CBU", "Lex.uz", "Yangi", "Ko'rib chiqilgan"].map(c => (
          <button key={c} onClick={() => setMonFilter(c)}
            className="text-[12px] font-bold px-3.5 py-1.5 rounded-full cursor-pointer transition-all"
            style={monFilter === c
              ? { background: `${lime}22`, border: `1px solid ${lime}55`, color: lime }
              : { background: panel, border: `1px solid ${panelBorder}`, color: txt2, backdropFilter: "blur(10px)" }}>
            {c}
          </button>
        ))}
      </div>

      <div style={glass()}>
        {[
          {
            src: "CBU.UZ", srcColor: "#6BB4F5", srcBg: "rgba(107,180,245,.14)",
            title: "Markaziy bank Boshqaruvining qarori № 145/2026 — kreditlash talablarini yangilash",
            date: "Qabul qilingan: 10.07.2026 · aniqlandi: bugun 12:03",
            related: ["Kredit berish tartibi N-12 · 91%", "Kredit qo'mitasi nizomi N-08 · 84%", "Yo'riqnoma Y-30 · 79%"],
            when: "bugun", status: "review",
          },
          {
            src: "LEX.UZ", srcColor: "#B39CF5", srcBg: "rgba(179,156,245,.14)",
            title: "O'RQ-812 — \"Elektron hujjat aylanishi to'g'risida\"gi qonunga o'zgartirishlar",
            date: "Qabul qilingan: 08.07.2026 · aniqlandi: bugun 08:11",
            related: ["Axborot xavfsizligi siyosati S-03 · 88%", "Ichki nazorat reglamenti R-07 · 76%"],
            when: "bugun", status: "review",
          },
          {
            src: "CBU.UZ", srcColor: "#6BB4F5", srcBg: "rgba(107,180,245,.14)",
            title: "Press-reliz: majburiy zaxira normativlari o'zgarishi to'g'risida",
            date: "05.07.2026 · S. Nazarov ko'rib chiqdi, ta'sir yo'q deb belgiladi",
            related: [],
            noMatch: "Aloqadorlik topilmadi (threshold 82%)",
            when: "3 kun oldin", status: "active",
          },
        ].map((row, i, arr) => (
          <div key={i} className="grid items-start gap-4"
            style={{
              gridTemplateColumns: "auto 1fr auto",
              padding: "18px 22px",
              borderBottom: i < arr.length - 1 ? `1px solid ${panelBorder}` : "none",
            }}>
            <span className="text-[10px] font-extrabold tracking-wide mt-0.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: row.srcBg, color: row.srcColor }}>
              {row.src}
            </span>
            <div>
              <h4 className="text-[14px] font-bold mb-1 font-['Manrope']" style={{ color: txt }}>{row.title}</h4>
              <p className="text-[11.5px] font-semibold mb-2" style={{ color: txt3 }}>{row.date}</p>
              <div className="flex gap-2 flex-wrap">
                {row.noMatch
                  ? <span className="text-[10.5px] font-bold px-3 py-1 rounded-full" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>{row.noMatch}</span>
                  : <>
                    <span className="text-[10.5px] font-bold px-3 py-1 rounded-full" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>Aloqador ichki hujjatlar:</span>
                    {row.related.map(r => (
                      <span key={r} className="text-[10.5px] font-bold px-3 py-1 rounded-full cursor-pointer"
                        style={{ background: `${lime}18`, color: lime }}>
                        {r}
                      </span>
                    ))}
                  </>
                }
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold mb-2" style={{ color: txt3 }}>{row.when}</p>
              <StatusBadge status={row.status} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] font-semibold mt-3 px-1 leading-relaxed" style={{ color: txt3 }}>
        O'xshashlik foizi hujjatlar mazmunan yaqinligini bildiradi, ziddiyat hukmi emas — yakuniy xulosani mas'ul xodim beradi.
      </p>
    </div>
  );

  // ── CMD+K ──────────────────────────────────────────────────────────────────
  const CmdK = cmdkOpen && (
    <div className="fixed inset-0 z-[90] flex items-start justify-center"
      style={{ background: isDark ? "rgba(0,6,14,.55)" : "rgba(20,40,32,.3)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && setCmdkOpen(false)}>
      <div className="mt-[12vh] overflow-hidden"
        style={{ width: "min(620px, 92vw)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, borderRadius: 18, backdropFilter: "blur(24px)", boxShadow: "0 32px 80px rgba(0,0,0,.55)" }}>
        <input autoFocus value={cmdkQuery} onChange={e => setCmdkQuery(e.target.value)}
          placeholder="Hujjat, papka yoki amal qidiring..."
          className="w-full bg-transparent outline-none"
          style={{ padding: "18px 20px", fontSize: 15, color: txt, fontFamily: "Manrope", fontWeight: 600, borderBottom: `1px solid ${panelBorder}` }} />
        <div>
          {CMDK_ITEMS.map(group => {
            const filtered = group.items.filter(it => it.key.includes(cmdkQuery.toLowerCase()) || cmdkQuery === "");
            if (!filtered.length) return null;
            return (
              <div key={group.section}>
                <p className="text-[10px] font-extrabold uppercase tracking-[.7px] px-5 pt-3 pb-1.5" style={{ color: txt3 }}>{group.section}</p>
                {filtered.map(item => (
                  <div key={item.key}
                    onClick={() => {
                      setCmdkOpen(false);
                      if (item.action === "wiz") { setWizOpen(true); setWizStep(1); }
                      else if (item.action === "graph") goView("graph");
                      else if (item.action === "doc") goView("doc");
                      else if (item.action === "vault") goView("vault");
                      else if (item.action === "mon") goView("mon");
                    }}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-all text-[13.5px] font-bold"
                    style={{ color: txt2 }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${lime}14`)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ color: txt3 }}>{item.icon}</span>
                    <span style={{ flex: 1, color: txt }}>{item.label}</span>
                    {item.kbd && <kbd className="text-[10px] font-extrabold px-2 py-0.5 rounded-[5px]" style={{ border: `1px solid ${panelBorder}`, color: txt3 }}>{item.kbd}</kbd>}
                    {item.sub && <span className="text-[11px] font-semibold" style={{ color: txt3 }}>{item.sub}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 px-5 py-2.5 text-[10.5px] font-bold" style={{ borderTop: `1px solid ${panelBorder}`, color: txt3 }}>
          {[["↑↓", "tanlash"], ["↵", "ochish"], ["esc", "yopish"]].map(([k, v]) => (
            <span key={k}><span className="border rounded px-1.5 py-0.5 mr-1" style={{ borderColor: panelBorder }}>{k}</span>{v}</span>
          ))}
          <span className="ml-auto">Semantik qidiruv: "ma'no:" bilan boshlang</span>
        </div>
      </div>
    </div>
  );

  // ── NOTIFICATION DRAWER ────────────────────────────────────────────────────
  const Drawer = (
    <div className="fixed top-0 right-0 bottom-0 z-[95] overflow-auto transition-transform duration-300"
      style={{
        width: 360, maxWidth: "92vw",
        background: isDark ? "#1E1E1E" : "#fff",
        borderLeft: `1px solid ${panelBorder}`,
        backdropFilter: "blur(26px)",
        boxShadow: "0 0 60px rgba(0,0,0,.4)",
        padding: 22,
        transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
      }}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="font-['Sora'] text-[16px] font-semibold" style={{ color: txt }}>Xabarnomalar</h2>
        <button onClick={() => setDrawerOpen(false)} style={{ color: txt3, fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <p className="text-[11.5px] font-bold mb-4" style={{ color: txt3 }}>
        2 o'qilmagan · <span className="cursor-pointer" style={{ color: lime }}>hammasini o'qilgan qilish</span>
      </p>
      {[
        { warn: true, title: "CBU qarori № 145/2026 aniqlandi", body: "4 ta ichki hujjat bilan yuqori o'xshashlik. N-12 (91%) birinchi o'rinda.", go: "Monitoring'da ochish →", goAction: () => { setDrawerOpen(false); goView("mon"); } },
        { warn: true, title: "Lex.uz: O'RQ-812 o'zgartirishlar", body: "S-03 va R-07 hujjatlaringizga aloqador bo'lishi mumkin.", go: "Ko'rish →", goAction: () => { setDrawerOpen(false); goView("mon"); } },
        { warn: false, title: "Taqqoslama shablon tayyor", body: "N-12 v2.0 uchun shablon generatsiya qilindi (14 band).", go: "Yuklab olish →", goAction: () => toast("Shablon yuklab olinmoqda...") },
        { warn: false, title: "S-03 tasdiq kutmoqda", body: "D. Rahimova 6 kun oldin yuborgan. Siz tasdiqlovchisiz.", go: "Ko'rib chiqish →", goAction: () => goView("doc") },
        { warn: false, title: "R-07 tasdiqlandi", body: "Sh. Tosheva tasdiqladi, hujjat ACTIVE holatga o'tdi.", go: "", goAction: () => {} },
      ].map((n, i) => (
        <div key={i} className="rounded-[13px] mb-2.5 text-[12.5px]"
          style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}`, padding: "12px 14px" }}>
          <p className="flex items-center gap-2 font-bold mb-1" style={{ color: txt }}>
            <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: n.warn ? "#F0C24B" : lime }} />
            {n.title}
          </p>
          <p className="font-semibold leading-relaxed" style={{ color: txt2 }}>{n.body}</p>
          {n.go && <span onClick={n.goAction} className="inline-block mt-2 text-[11px] font-extrabold cursor-pointer" style={{ color: lime }}>{n.go}</span>}
        </div>
      ))}
    </div>
  );

  // ── UPLOAD WIZARD ─────────────────────────────────────────────────────────
  const Wizard = wizOpen && (
    <div className="fixed inset-0 z-[90] flex items-start justify-center"
      style={{ background: isDark ? "rgba(0,6,14,.55)" : "rgba(20,40,32,.3)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && setWizOpen(false)}>
      <div className="mt-[9vh] overflow-hidden"
        style={{ width: "min(560px, 94vw)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, borderRadius: 20, backdropFilter: "blur(26px)", boxShadow: "0 32px 80px rgba(0,0,0,.55)", padding: 26 }}>
        <h2 className="font-['Sora'] text-[17px] font-semibold mb-1" style={{ color: txt }}>Yangi hujjat</h2>
        <p className="text-[12px] font-semibold mb-4" style={{ color: txt2 }}>
          {["1-qadam · Fayllarni yuklang", "2-qadam · Metadata", "3-qadam · Bog'lanishlar va ko'rib chiqish"][wizStep - 1]}
        </p>
        {/* Steps bar */}
        <div className="flex gap-1.5 mb-5">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full" style={{ background: s <= wizStep ? lime : panelBorder }} />
          ))}
        </div>

        {wizStep === 1 && (
          <div>
            {["Tasdiqlangan PDF (majburiy)", "Word versiyasi (tavsiya)"].map((label, i) => {
              const fname = i === 0 ? "Nizom_N-24_tasdiqlangan.pdf" : "Nizom_N-24.docx";
              const fmeta = i === 0 ? "PDF · 2.4 MB" : "DOCX · 84 KB";
              return pickedFiles.includes(fname) ? (
                <div key={i} className="flex items-center gap-3 text-[12.5px] font-bold mb-2.5 rounded-xl px-3.5 py-3"
                  style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", border: `1px solid ${panelBorder}` }}>
                  <FileText size={15} style={{ color: txt3 }} />
                  <span style={{ color: txt }}>{fname}</span>
                  <span className="font-semibold" style={{ color: txt3 }}>· {fmeta}</span>
                  <span className="ml-auto text-[11px] font-extrabold" style={{ color: lime }}>✓ hash tekshirildi</span>
                </div>
              ) : (
                <div key={i} onClick={() => setPickedFiles(f => [...f, fname])}
                  className="rounded-2xl text-center cursor-pointer transition-all mb-3 hover:border-[#C6F24E]"
                  style={{ border: `1.5px dashed ${panelBorder}`, padding: "28px 20px" }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${lime}10`)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <Upload size={28} className="mx-auto mb-2" style={{ color: txt3 }} />
                  <p className="font-bold text-[13.5px] mb-1" style={{ color: txt }}>{label}</p>
                  <p className="text-[11.5px] font-semibold" style={{ color: txt3 }}>
                    {i === 0 ? "Bosing yoki faylni tashlang · maks. 50 MB" : "Kelajakda avtomatik taqqoslama uchun kerak bo'ladi"}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {wizStep === 2 && (
          <div className="space-y-3">
            {[
              { label: "Hujjat nomi", val: "Ta'minotni baholash tartibi to'g'risidagi Nizom", full: true },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{f.label}</label>
                <input defaultValue={f.val} className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                  style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Raqami", val: "N-24" },
                { label: "Turi", isSelect: true },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{f.label}</label>
                  {f.isSelect
                    ? <select className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                        style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }}>
                        {["Nizom", "Buyruq", "Reglament", "Siyosat"].map(o => <option key={o}>{o}</option>)}
                      </select>
                    : <input defaultValue={f.val} className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                        style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "Tasdiqlangan sana", val: "11.07.2026" }, { label: "Podrazdeleniye", isSelect: true }].map(f => (
                <div key={f.label}>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{f.label}</label>
                  {f.isSelect
                    ? <select className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                        style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }}>
                        <option>Kredit departamenti</option><option>Yuridik bo'lim</option>
                      </select>
                    : <input defaultValue={f.val} className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                        style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />}
                </div>
              ))}
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>Teglar</label>
              <input defaultValue="CBU, ta'minot" className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />
            </div>
          </div>
        )}

        {wizStep === 3 && (
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wide mb-3" style={{ color: txt3 }}>Bog'lanishlar (ixtiyoriy)</p>
            {[
              { type: "asos", typeColor: "#C6F24E", typeBg: "rgba(198,242,78,.15)", label: "CBU qarori № 145/2026" },
              { type: "ota", typeColor: "#6BB4F5", typeBg: "rgba(107,180,245,.15)", label: "Kredit berish tartibi N-12" },
            ].map((rel, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 text-[12.5px] font-semibold" style={{ color: txt2 }}>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-[6px]"
                  style={{ background: rel.typeBg, color: rel.typeColor }}>{rel.type}</span>
                <span className="flex-1" style={{ color: txt }}>{rel.label}</span>
                <span className="cursor-pointer font-bold" style={{ color: txt3 }}>✕</span>
              </div>
            ))}
            <button className="mt-2 text-[12.5px] font-bold px-3.5 py-2 rounded-xl cursor-pointer"
              style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
              + Bog'lanish qo'shish
            </button>
            <div className="mt-4 rounded-[13px] text-[12.5px]"
              style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}`, padding: "12px 14px" }}>
              <p className="flex items-center gap-2 font-bold mb-1" style={{ color: txt }}>
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: lime }} />
                Tayyor
              </p>
              <p className="font-semibold leading-relaxed" style={{ color: txt2 }}>
                N-24 · Nizom · Kredit departamenti · 2 fayl · 2 bog'lanish. Saqlangach hujjat DRAFT holatida yaratiladi.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-5">
          <button onClick={() => setWizStep(s => Math.max(1, s - 1) as 1 | 2 | 3)}
            className="text-[12.5px] font-bold px-4 py-2.5 rounded-[13px] cursor-pointer"
            style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2, visibility: wizStep > 1 ? "visible" : "hidden" }}>
            ← Orqaga
          </button>
          <button onClick={() => {
            if (wizStep < 3) setWizStep(s => (s + 1) as 1 | 2 | 3);
            else { setWizOpen(false); setPickedFiles([]); setWizStep(1); toast("N-24 saqlandi · DRAFT holatida yaratildi"); }
          }}
            className="text-[12.5px] font-bold px-5 py-2.5 rounded-[13px] cursor-pointer"
            style={{ background: lime, color: "#0A1600", border: "none", boxShadow: `0 6px 18px ${lime}44` }}>
            {wizStep < 3 ? "Davom etish →" : "Saqlash ✓"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── BULK BAR ──────────────────────────────────────────────────────────────
  const BulkBar = (
    <div className="fixed z-[60] transition-all duration-300"
      style={{
        bottom: 86, left: "50%",
        transform: `translateX(-50%) translateY(${selected.size > 0 ? 0 : 20}px)`,
        opacity: selected.size > 0 ? 1 : 0,
        pointerEvents: selected.size > 0 ? "auto" : "none",
        display: "flex", alignItems: "center", gap: 6,
        background: isDark ? "#1E1E1E" : "#fff",
        border: `1px solid ${panelBorder}`,
        borderRadius: 16, padding: "9px 10px 9px 18px",
        backdropFilter: "blur(22px)",
        boxShadow: "0 24px 60px rgba(0,0,0,.5)",
        fontSize: 12.5, fontWeight: 800, color: txt,
      }}>
      <strong style={{ color: lime, marginRight: 6 }}>{selected.size}</strong> hujjat tanlandi
      {[
        { label: "Yuklab olish", icon: <Download size={13} />, action: () => toast("ZIP arxiv tayyorlanmoqda...") },
        { label: "Teg", icon: <Tag size={13} />, action: () => toast("Teg qo'shildi") },
        { label: "Ko'chirish", icon: <Move size={13} />, action: () => toast("Papkaga ko'chirildi") },
        { label: "O'chirish", icon: <Trash2 size={13} />, action: () => toast("Chiqindi qutisiga o'tkazildi · 30 kun ichida tiklash mumkin"), red: true },
      ].map(btn => (
        <button key={btn.label} onClick={btn.action}
          className="flex items-center gap-1.5 text-[11.5px] font-bold px-3 py-1.5 rounded-xl cursor-pointer"
          style={{ background: panel, border: `1px solid ${panelBorder}`, color: btn.red ? "#F07A6B" : txt2 }}>
          {btn.icon} {btn.label}
        </button>
      ))}
    </div>
  );

  // ── TOASTS ────────────────────────────────────────────────────────────────
  const Toasts = (
    <div className="fixed bottom-20 right-5 z-[99] flex flex-col gap-2.5">
      {toasts.map(t => (
        <div key={t.id} className="flex items-center gap-3 text-[12.5px] font-bold rounded-2xl px-4 py-3"
          style={{
            background: isDark ? "#1E1E1E" : "#fff",
            border: `1px solid ${panelBorder}`,
            backdropFilter: "blur(20px)",
            boxShadow: "0 16px 40px rgba(0,0,0,.4)",
            color: txt,
            animation: "slideIn .3s ease",
          }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: lime }} />
          {t.msg}
        </div>
      ))}
    </div>
  );

  // ── VIEW BAR (floating bottom navigation) ────────────────────────────────
  const ViewBar = (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 overflow-x-auto"
      style={{
        background: isDark ? "#1E1E1E" : "#fff",
        border: `1px solid ${panelBorder}`,
        borderRadius: 999, padding: 6,
        backdropFilter: "blur(20px)",
        boxShadow: "0 24px 60px rgba(0,0,0,.5)",
        maxWidth: "94vw",
      }}>
      {[
        { v: "dash" as View, label: "Dashboard" },
        { v: "vault" as View, label: "Vault" },
        { v: "doc" as View, label: "Hujjat" },
        { v: "graph" as View, label: "Graf" },
        { v: "mon" as View, label: "Monitoring" },
      ].map(item => (
        <button key={item.v} onClick={() => goView(item.v)}
          className="text-[12px] font-extrabold px-4 py-2.5 rounded-full cursor-pointer transition-all whitespace-nowrap"
          style={view === item.v
            ? { background: lime, color: "#0A1600", border: "none" }
            : { background: "transparent", color: txt2, border: "none" }}>
          {item.label}
        </button>
      ))}
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: bg, minHeight: "100vh", position: "relative" }}>
      {/* Background ambient glows */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", right: "5%", width: 900, height: 500, borderRadius: "50%", background: `radial-gradient(ellipse, ${lime}18 0%, transparent 65%)`, filter: "blur(1px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 700, height: 500, borderRadius: "50%", background: `radial-gradient(ellipse, ${lime}0C 0%, transparent 60%)`, filter: "blur(1px)" }} />
      </div>

      <div className="flex" style={{ position: "relative", zIndex: 1 }}>
        {Rail}
        {TreeSidebar}

        <main style={{ flex: 1, padding: "24px 32px 110px", minWidth: 0 }}>
          {TopBar}

          <div style={{ animation: "fadeIn .35s ease" }}>
            {view === "dash" && Dashboard}
            {view === "vault" && Vault}
            {view === "doc" && DocDetail}
            {view === "graph" && <GraphView onNavigate={goView} />}
            {view === "mon" && Monitoring}
          </div>
        </main>
      </div>

      {/* Overlays */}
      {CmdK}
      {Drawer}
      {Wizard}
      {BulkBar}
      {Toasts}
      {ViewBar}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: none; } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.22); }
      `}</style>
    </div>
  );
}
