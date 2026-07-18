import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { DocStatus, DocumentTypeSummary, GraphData, GraphNode, RelationType } from "@docmax/shared";
import { graphApi, ApiRequestError } from "@/lib/api";
import type { AdminTheme } from "./AdminPanel";

// TZ-2 §2.3 — Bog'lanishlar grafi (Obsidian uslubi): hujjat = node, o'lcham = bog'lanish soni,
// rang rejimi toggle (tur / holat), hover'da qo'shnilarni highlight, click → yon panel + ochish.
// Etalon build canvas force-layout (react-force-graph-2d o'rniga — kam bog'liqlik, TZ-0 pdf.js→iframe kabi).

type ColorMode = "type" | "status";

const STATUS_COLOR: Record<DocStatus, string> = {
  ACTIVE: "#C6F24E",
  IN_REVIEW: "#F0C24B",
  DRAFT: "#F07A6B",
  EXPIRED: "#8FA0A8",
};

const TYPE_PALETTE = ["#C6F24E", "#6BB4F5", "#B39CF5", "#F0C24B", "#F07A6B", "#5EEAD4", "#F4A8D4", "#9CC5F5"];

// i18n status kalitlari kichik harfli (status.active/review/draft/expired)
const STATUS_I18N: Record<DocStatus, string> = {
  ACTIVE: "status.active",
  IN_REVIEW: "status.review",
  DRAFT: "status.draft",
  EXPIRED: "status.expired",
};

const EDGE_COLOR: Record<RelationType, string> = {
  RELATED: "rgba(255,255,255,.22)",
  PARENT_CHILD: "#6BB4F5",
  AMENDS: "#F0C24B",
  REPLACES: "#F07A6B",
  BASED_ON: "#C6F24E",
};

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export default function GraphView({ theme, docTypes, onOpenDocument }: {
  theme: AdminTheme;
  docTypes: DocumentTypeSummary[];
  onOpenDocument: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { isDark, lime, txt, txt2, txt3 } = theme;

  const [colorMode, setColorMode] = useState<ColorMode>("status");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showIsolated, setShowIsolated] = useState(true);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const dataRef = useRef<GraphData>({ nodes: [], edges: [] });
  const hoverRef = useRef<string | null>(null);
  const frameRef = useRef<number>(0);
  const colorModeRef = useRef<ColorMode>(colorMode);

  // Tur nomi → barqaror rang (indeks bo'yicha)
  const typeColorOf = useMemo(() => {
    const order = docTypes.map((d) => d.name);
    return (name: string) => {
      const i = order.indexOf(name);
      return TYPE_PALETTE[(i >= 0 ? i : name.length) % TYPE_PALETTE.length];
    };
  }, [docTypes]);

  const nodeColor = (n: GraphNode) => (colorModeRef.current === "status" ? STATUS_COLOR[n.status] : typeColorOf(n.docTypeName));

  // Ma'lumot yuklash (filtrlar o'zgarganda)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    graphApi
      .get({ status: statusFilter || undefined, docTypeId: typeFilter || undefined, includeIsolated: showIsolated })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiRequestError ? err.body.message : t("errors.graphLoad")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, typeFilter, showIsolated]);

  useEffect(() => { colorModeRef.current = colorMode; }, [colorMode]);

  // Yangi ma'lumot kelganda simulyatsiya node'larini qayta urug'lash
  useEffect(() => {
    if (!data) return;
    dataRef.current = data;
    const wrap = canvasRef.current?.parentElement;
    const W = wrap?.clientWidth ?? 800, H = wrap?.clientHeight ?? 500;
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const maxDeg = Math.max(1, ...data.nodes.map((n) => n.degree));
    nodesRef.current = data.nodes.map((n) => {
      const old = prev.get(n.id);
      return {
        ...n,
        x: old?.x ?? W / 2 + (Math.random() - 0.5) * Math.min(W, 640),
        y: old?.y ?? H / 2 + (Math.random() - 0.5) * Math.min(H, 520),
        vx: 0, vy: 0,
        r: 7 + (n.degree / maxDeg) * 11,
      };
    });
    setSelected((s) => (s && data.nodes.some((n) => n.id === s.id) ? s : null));
  }, [data]);

  // Force simulyatsiya + chizish (bir marta o'rnatiladi, ref'lardan o'qiydi)
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

    function tick() {
      const nodes = nodesRef.current;
      const edges = dataRef.current.edges;
      const byId: Record<string, SimNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const W = wrap.clientWidth, H = wrap.clientHeight;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          // Masofa poli (>=24) — juda yaqinlashganda kuch portlab ketmasligi uchun (n-body barqarorlik)
          const d = Math.max(Math.hypot(dx, dy), 24);
          const f = 1400 / (d * d);
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f;
          b.vx += dx * f; b.vy += dy * f;
        }
      }
      edges.forEach((e) => {
        const a = byId[e.source], b = byId[e.target];
        if (!a || !b) return;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d - 120) * 0.02; // spring — d bilan ko'paytirilmaydi (barqarorroq)
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      });
      nodes.forEach((n) => {
        n.vx += (W / 2 - n.x) * 0.004;
        n.vy += (H / 2 - n.y) * 0.004;
        n.vx *= 0.82; n.vy *= 0.82;
        // Tezlik chegarasi — sakrashlarni oldini oladi
        n.vx = Math.max(-24, Math.min(24, n.vx));
        n.vy = Math.max(-24, Math.min(24, n.vy));
        n.x += n.vx; n.y += n.vy;
        // NaN/chegaradan tashqari himoya
        if (!Number.isFinite(n.x) || n.x < -40 || n.x > W + 40) n.x = Math.min(Math.max(n.x || W / 2, 30), W - 30);
        if (!Number.isFinite(n.y) || n.y < -40 || n.y > H + 40) n.y = Math.min(Math.max(n.y || H / 2, 30), H - 30);
      });

      ctx.clearRect(0, 0, W, H);
      const h = hoverRef.current;
      const neighbors = new Set<string>();
      if (h) { neighbors.add(h); edges.forEach((e) => { if (e.source === h) neighbors.add(e.target); if (e.target === h) neighbors.add(e.source); }); }

      edges.forEach((e) => {
        const a = byId[e.source], b = byId[e.target];
        if (!a || !b) return;
        const lit = h && (e.source === h || e.target === h);
        ctx.strokeStyle = lit ? EDGE_COLOR[e.type] : (h ? "rgba(255,255,255,.05)" : EDGE_COLOR[e.type]);
        ctx.globalAlpha = lit ? 0.95 : (h ? 0.35 : 0.55);
        ctx.lineWidth = lit ? 2.2 : 1.2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      nodes.forEach((n) => {
        const dim = h ? !neighbors.has(n.id) : false;
        ctx.globalAlpha = dim ? 0.18 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor(n);
        ctx.fill();
        if (n.id === h) {
          ctx.strokeStyle = nodeColor(n);
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (!dim && (n.r > 10 || n.id === h || nodes.length < 40)) {
          ctx.fillStyle = isDark ? "rgba(237,243,240,.9)" : "rgba(20,30,25,.85)";
          ctx.font = "700 10px Manrope";
          ctx.textAlign = "center";
          const label = n.docNumber ? `${n.docNumber}` : n.title.slice(0, 18);
          ctx.fillText(label, n.x, n.y + n.r + 13);
        }
        ctx.globalAlpha = 1;
      });

      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const found = nodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) < n.r + 7);
    hoverRef.current = found?.id ?? null;
    canvasRef.current!.style.cursor = found ? "pointer" : "default";
  }

  function handleClick() {
    const h = hoverRef.current;
    setSelected(h ? dataRef.current.nodes.find((n) => n.id === h) ?? null : null);
  }

  const panelBg = isDark ? "rgba(26,26,26,.92)" : "rgba(255,255,255,.95)";
  const panelBorderC = isDark ? "rgba(255,255,255,.09)" : "rgba(10,30,20,.09)";
  const selDegree = selected ? selected.degree : 0;

  const legend = colorMode === "status"
    ? (["ACTIVE", "IN_REVIEW", "DRAFT", "EXPIRED"] as DocStatus[]).map((s) => ({ color: STATUS_COLOR[s], label: t(STATUS_I18N[s]) }))
    : docTypes.slice(0, 8).map((d) => ({ color: typeColorOf(d.name), label: d.name }));

  return (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: txt }}>{t("graph.title")}</h1>
          <p className="text-sm mt-1" style={{ color: txt2 }}>{t("graph.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Rang rejimi */}
          <div className="flex p-1 gap-0.5 rounded-[10px]" style={{ background: panelBg, border: `1px solid ${panelBorderC}` }}>
            {([["status", t("graph.colorByStatus")], ["type", t("graph.colorByType")]] as const).map(([m, label]) => (
              <span key={m} onClick={() => setColorMode(m)}
                className="text-[11px] font-extrabold px-3 py-[5px] rounded-lg cursor-pointer"
                style={colorMode === m ? { background: isDark ? "rgba(255,255,255,.12)" : "#fff", color: txt } : { color: txt3 }}>
                {label}
              </span>
            ))}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DocStatus | "")}
            className="text-[12px] font-bold px-3 py-2 rounded-[10px] outline-none cursor-pointer"
            style={{ background: panelBg, border: `1px solid ${panelBorderC}`, color: txt2 }}>
            <option value="">{t("graph.allStatuses")}</option>
            {(["ACTIVE", "IN_REVIEW", "DRAFT", "EXPIRED"] as DocStatus[]).map((s) => <option key={s} value={s}>{t(STATUS_I18N[s])}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="text-[12px] font-bold px-3 py-2 rounded-[10px] outline-none cursor-pointer"
            style={{ background: panelBg, border: `1px solid ${panelBorderC}`, color: txt2 }}>
            <option value="">{t("graph.allTypes")}</option>
            {docTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={() => setShowIsolated((v) => !v)}
            className="text-[11.5px] font-bold px-3 py-2 rounded-[10px] cursor-pointer"
            style={{ background: showIsolated ? `${lime}18` : panelBg, border: `1px solid ${showIsolated ? lime + "55" : panelBorderC}`, color: showIsolated ? (isDark ? lime : "#2FA45B") : txt3 }}>
            {t("graph.isolatedToggle")}
          </button>
        </div>
      </div>

      <div className="relative" style={{ height: "calc(100vh - 240px)", minHeight: 460, borderRadius: 20, overflow: "hidden", background: isDark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorderC}` }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} onMouseMove={handleMouseMove} onClick={handleClick} />

        {/* Legend */}
        <div className="absolute top-3.5 left-3.5 text-[11.5px] font-bold space-y-1" style={{ background: panelBg, border: `1px solid ${panelBorderC}`, borderRadius: 14, padding: "12px 16px", backdropFilter: "blur(16px)", maxHeight: 220, overflow: "auto" }}>
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-2" style={{ color: txt2 }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin" style={{ color: txt3 }} />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold" style={{ color: "#F07A6B" }}>{error}</div>
        )}
        {!loading && !error && data && data.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold" style={{ color: txt3 }}>{t("graph.empty")}</div>
        )}

        {/* Tanlangan node paneli */}
        {selected && (
          <div className="absolute top-3.5 right-3.5 w-64 text-sm" style={{ background: panelBg, border: `1px solid ${panelBorderC}`, borderRadius: 16, padding: 16, backdropFilter: "blur(18px)" }}>
            <p className="font-['Sora'] font-semibold mb-1 leading-snug" style={{ color: txt }}>{selected.title}</p>
            <p className="text-[11px] font-semibold mb-3" style={{ color: txt3 }}>
              {selected.docNumber ? `${selected.docNumber} · ` : ""}{selected.docTypeName} · {selDegree} {t("graph.relationsSuffix")}
            </p>
            <button onClick={() => onOpenDocument(selected.id)}
              className="w-full text-center text-[12.5px] font-bold py-2 rounded-xl transition-colors"
              style={{ background: `${lime}18`, color: isDark ? lime : "#2FA45B", border: `1px solid ${lime}44` }}>
              {t("graph.openDoc")}
            </button>
          </div>
        )}

        {/* Statistika */}
        {data && !loading && (
          <div className="absolute bottom-3.5 left-3.5 text-[11px] font-bold px-3 py-1.5 rounded-[10px]" style={{ background: panelBg, border: `1px solid ${panelBorderC}`, color: txt3 }}>
            {t("graph.stats", { nodes: data.nodes.length, edges: data.edges.length })}
          </div>
        )}
      </div>
    </div>
  );
}
