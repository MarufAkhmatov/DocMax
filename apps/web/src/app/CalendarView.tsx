import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { DocStatus, DocumentSummary } from "@docmax/shared";
import { documentsApi, ApiRequestError } from "@/lib/api";
import type { AdminTheme } from "./AdminPanel";

// ─── Kalendar ko'rinishi — hujjatlar tasdiqlangan yoki yuklangan sana bo'yicha ──
// Oy / Hafta / Yil rejimlari; pill bosilganda hujjat sahifasi ochiladi.

type CalMode = "month" | "week" | "year";
type CalDateField = "approvedAt" | "createdAt";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeekMonday(d: Date): Date {
  const s = startOfDay(d);
  const shift = (s.getDay() + 6) % 7; // Du=0 ... Ya=6
  s.setDate(s.getDate() - shift);
  return s;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function CalendarView({ theme, onOpenDocument }: {
  theme: AdminTheme;
  onOpenDocument: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { isDark, lime, panel, panelBorder, txt, txt2, txt3 } = theme;

  const [mode, setMode] = useState<CalMode>("month");
  const [dateField, setDateField] = useState<CalDateField>("approvedAt");
  const [anchor, setAnchor] = useState<Date>(startOfDay(new Date()));
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = startOfDay(new Date());

  // Ko'rinayotgan davr chegaralari [from, to)
  const range = useMemo(() => {
    if (mode === "week") {
      const from = startOfWeekMonday(anchor);
      return { from, to: addDays(from, 7) };
    }
    if (mode === "year") {
      return { from: new Date(anchor.getFullYear(), 0, 1), to: new Date(anchor.getFullYear() + 1, 0, 1) };
    }
    return { from: new Date(anchor.getFullYear(), anchor.getMonth(), 1), to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
  }, [mode, anchor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    documentsApi
      .list({
        dateField,
        from: range.from.toISOString() as never,
        to: range.to.toISOString() as never,
        limit: 100,
        sort: dateField,
        order: "asc",
      })
      .then((res) => {
        if (!cancelled) setDocs(res.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiRequestError ? err.body.message : t("errors.calendarLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateField, range.from.getTime(), range.to.getTime()]);

  // Kun bo'yicha guruhlash
  const byDay = useMemo(() => {
    const map = new Map<string, DocumentSummary[]>();
    for (const doc of docs) {
      const when = dateField === "approvedAt" ? doc.approvedAt : doc.createdAt;
      if (!when) continue;
      const key = dayKey(new Date(when));
      const list = map.get(key) ?? [];
      list.push(doc);
      map.set(key, list);
    }
    return map;
  }, [docs, dateField]);

  const STATUS_PILL: Record<DocStatus, { bg: string; color: string }> = {
    ACTIVE: { bg: `${lime}20`, color: isDark ? lime : "#2FA45B" },
    IN_REVIEW: { bg: "rgba(240,194,75,.16)", color: "#F0C24B" },
    DRAFT: { bg: "rgba(240,122,107,.16)", color: "#F07A6B" },
    EXPIRED: { bg: isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", color: txt3 },
  };

  const monthFmt = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" });
  const monthShortFmt = new Intl.DateTimeFormat(i18n.language, { month: "long" });
  const dayFmt = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });
  // Haftaning qisqa kun nomlari (Du..Ya) — ma'lum dushanbadan boshlab
  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    const monday = startOfWeekMonday(new Date(2026, 0, 5));
    return Array.from({ length: 7 }, (_, i) => fmt.format(addDays(monday, i)));
  }, [i18n.language]);

  const headerLabel =
    mode === "year"
      ? String(anchor.getFullYear())
      : mode === "week"
        ? `${dayFmt.format(range.from)} — ${dayFmt.format(addDays(range.to, -1))}, ${range.from.getFullYear()}`
        : monthFmt.format(anchor);

  const shift = (dir: -1 | 1) => {
    if (mode === "week") setAnchor(addDays(anchor, dir * 7));
    else if (mode === "year") setAnchor(new Date(anchor.getFullYear() + dir, anchor.getMonth(), 1));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  };

  const glass: React.CSSProperties = {
    background: panel,
    border: `1px solid ${panelBorder}`,
    backdropFilter: "blur(16px)",
    borderRadius: 20,
  };

  const segBtn = (active: boolean): React.CSSProperties =>
    active
      ? { background: isDark ? "rgba(255,255,255,.12)" : "#fff", color: txt }
      : { color: txt3 };

  const DocPill = ({ doc, compact }: { doc: DocumentSummary; compact?: boolean }) => {
    const s = STATUS_PILL[doc.status];
    return (
      <div onClick={(e) => { e.stopPropagation(); onOpenDocument(doc.id); }}
        title={`${doc.title}${doc.docNumber ? ` · № ${doc.docNumber}` : ""} · ${doc.docTypeName}`}
        className="cursor-pointer rounded-[6px] px-1.5 py-[3px] text-[10px] font-bold truncate transition-transform hover:scale-[1.03]"
        style={{ background: s.bg, color: s.color, maxWidth: "100%" }}>
        {compact ? doc.title : `${doc.docNumber ? doc.docNumber + " · " : ""}${doc.title}`}
      </div>
    );
  };

  // ── Oy to'ri ──
  const MonthGrid = () => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeekMonday(first);
    const weeks = Math.ceil((((first.getDay() + 6) % 7) + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7);
    const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
    return (
      <div>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {weekdayNames.map((w, i) => (
            <div key={i} className="text-center text-[10.5px] font-extrabold uppercase tracking-wide py-1"
              style={{ color: i >= 5 ? "#F07A6B" : txt3 }}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day) => {
            const inMonth = day.getMonth() === anchor.getMonth();
            const isToday = sameDay(day, today);
            const items = byDay.get(dayKey(day)) ?? [];
            return (
              <div key={day.toISOString()}
                onClick={() => { setAnchor(day); setMode("week"); }}
                className="rounded-[12px] p-1.5 cursor-pointer transition-colors"
                style={{
                  minHeight: 96,
                  background: inMonth ? (isDark ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.02)") : "transparent",
                  border: `1px solid ${isToday ? lime : inMonth ? panelBorder : "transparent"}`,
                  boxShadow: isToday ? `0 0 0 3px ${lime}25` : "none",
                  opacity: inMonth ? 1 : 0.38,
                }}
                onMouseEnter={(e) => { if (!isToday) e.currentTarget.style.borderColor = `${lime}55`; }}
                onMouseLeave={(e) => { if (!isToday) e.currentTarget.style.borderColor = inMonth ? panelBorder : "transparent"; }}>
                <div className="text-[11px] font-extrabold mb-1 px-0.5 flex items-center justify-between">
                  <span style={{ color: isToday ? lime : inMonth ? txt2 : txt3 }}>{day.getDate()}</span>
                  {items.length > 0 && (
                    <span className="rounded-full px-1.5 text-[9px]" style={{ background: `${lime}22`, color: isDark ? lime : "#2FA45B" }}>
                      {items.length}
                    </span>
                  )}
                </div>
                <div className="space-y-[3px]">
                  {items.slice(0, 3).map((doc) => <DocPill key={doc.id} doc={doc} compact />)}
                  {items.length > 3 && (
                    <div className="text-[9.5px] font-extrabold px-1" style={{ color: txt3 }}>+{items.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Hafta ──
  const WeekGrid = () => (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }, (_, i) => addDays(range.from, i)).map((day, i) => {
        const isToday = sameDay(day, today);
        const items = byDay.get(dayKey(day)) ?? [];
        return (
          <div key={i} className="rounded-[14px] p-2"
            style={{
              minHeight: 220,
              background: isDark ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.02)",
              border: `1px solid ${isToday ? lime : panelBorder}`,
              boxShadow: isToday ? `0 0 0 3px ${lime}25` : "none",
            }}>
            <div className="text-center mb-2 pb-2" style={{ borderBottom: `1px solid ${panelBorder}` }}>
              <div className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: i >= 5 ? "#F07A6B" : txt3 }}>
                {weekdayNames[i]}
              </div>
              <div className="font-['Sora'] text-[17px] font-semibold" style={{ color: isToday ? lime : txt }}>
                {day.getDate()}
              </div>
            </div>
            <div className="space-y-1.5">
              {items.map((doc) => (
                <div key={doc.id} onClick={() => onOpenDocument(doc.id)}
                  className="cursor-pointer rounded-[10px] p-2 transition-transform hover:scale-[1.02]"
                  style={{ background: STATUS_PILL[doc.status].bg, border: `1px solid ${panelBorder}` }}>
                  <p className="text-[11px] font-bold leading-tight mb-0.5" style={{ color: txt }}>{doc.title}</p>
                  <p className="text-[9.5px] font-extrabold" style={{ color: STATUS_PILL[doc.status].color }}>
                    {doc.docNumber ? `№ ${doc.docNumber} · ` : ""}{doc.docTypeName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Yil ──
  const YearGrid = () => (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
      {Array.from({ length: 12 }, (_, m) => {
        const monthStart = new Date(anchor.getFullYear(), m, 1);
        const daysInMonth = new Date(anchor.getFullYear(), m + 1, 0).getDate();
        const monthDocs = docs.filter((doc) => {
          const when = dateField === "approvedAt" ? doc.approvedAt : doc.createdAt;
          return when && new Date(when).getMonth() === m;
        });
        const activeDays = new Set(monthDocs.map((doc) => new Date((dateField === "approvedAt" ? doc.approvedAt : doc.createdAt)!).getDate()));
        const isCurrentMonth = today.getFullYear() === anchor.getFullYear() && today.getMonth() === m;
        return (
          <div key={m} onClick={() => { setAnchor(monthStart); setMode("month"); }}
            className="cursor-pointer rounded-[14px] p-3.5 transition-all hover:-translate-y-0.5"
            style={{
              background: isDark ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.02)",
              border: `1px solid ${isCurrentMonth ? lime : panelBorder}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${lime}66`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = isCurrentMonth ? lime : panelBorder)}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-['Sora'] text-[13px] font-semibold capitalize" style={{ color: isCurrentMonth ? lime : txt }}>
                {monthShortFmt.format(monthStart)}
              </span>
              {monthDocs.length > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: `${lime}22`, color: isDark ? lime : "#2FA45B" }}>
                  {monthDocs.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-[3px]">
              {Array.from({ length: daysInMonth }, (_, d) => (
                <span key={d} className="rounded-full" style={{
                  width: 7, height: 7,
                  background: activeDays.has(d + 1) ? lime : (isDark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.08)"),
                }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      {/* Sarlavha + boshqaruvlar */}
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight capitalize" style={{ color: txt }}>
            {t("cal.title")}
          </h1>
          <p className="text-sm mt-1" style={{ color: txt2 }}>
            {dateField === "approvedAt" ? t("cal.byApprovedHint") : t("cal.byCreatedHint")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sana maydoni almashtirgich */}
          <div className="flex p-1 gap-0.5" style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 10 }}>
            {([["approvedAt", t("cal.byApproved")], ["createdAt", t("cal.byCreated")]] as const).map(([value, label]) => (
              <span key={value} onClick={() => setDateField(value)}
                className="text-[11px] font-extrabold px-3 py-[5px] rounded-lg cursor-pointer whitespace-nowrap"
                style={segBtn(dateField === value)}>
                {label}
              </span>
            ))}
          </div>
          {/* Rejim almashtirgich */}
          <div className="flex p-1 gap-0.5" style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 10 }}>
            {([["week", t("cal.week")], ["month", t("cal.month")], ["year", t("cal.year")]] as const).map(([value, label]) => (
              <span key={value} onClick={() => setMode(value)}
                className="text-[11px] font-extrabold px-3 py-[5px] rounded-lg cursor-pointer"
                style={segBtn(mode === value)}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...glass, padding: 20 }}>
        {/* Davr navigatsiyasi */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <button onClick={() => shift(-1)} className="p-2 rounded-[10px] cursor-pointer transition-colors"
              style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => shift(1)} className="p-2 rounded-[10px] cursor-pointer transition-colors"
              style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>
              <ChevronRight size={15} />
            </button>
            <button onClick={() => setAnchor(startOfDay(new Date()))}
              className="text-[11.5px] font-extrabold px-3 py-2 rounded-[10px] cursor-pointer"
              style={{ background: `${lime}18`, border: `1px solid ${lime}44`, color: isDark ? lime : "#2FA45B" }}>
              {t("cal.today")}
            </button>
          </div>
          <h2 className="font-['Sora'] text-[16px] font-semibold capitalize" style={{ color: txt }}>{headerLabel}</h2>
          <span className="text-[11.5px] font-bold" style={{ color: txt3 }}>
            {t("cal.docsCount", { count: docs.length })}
          </span>
        </div>

        {error ? (
          <p className="text-[13px] font-semibold py-8 text-center" style={{ color: "#F07A6B" }}>{error}</p>
        ) : loading ? (
          <div className="py-16 text-center">
            <Loader2 size={22} className="animate-spin mx-auto" style={{ color: txt3 }} />
          </div>
        ) : (
          <>
            {mode === "month" && <MonthGrid />}
            {mode === "week" && <WeekGrid />}
            {mode === "year" && <YearGrid />}
            {docs.length === 0 && (
              <p className="text-[12.5px] font-semibold mt-4 text-center" style={{ color: txt3 }}>{t("cal.empty")}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
