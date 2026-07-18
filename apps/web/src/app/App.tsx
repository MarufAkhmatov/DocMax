import { useState, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, FolderOpen, Network, Activity, Settings,
  Sun, Moon, Bell, Search, Plus, Download, Upload, X, Lock,
  FileText, Check, Eye, Clock, Shield, Tag, Move, Trash2,
  ChevronRight, ChevronDown, GitBranch, Globe, BookOpen,
  ArrowRight, MoreHorizontal, Zap, Command, Loader2, Pencil, CalendarDays
} from "lucide-react";
import { useTranslation } from "react-i18next";
import * as mammoth from "mammoth";
import type { AuditLogEntry, DashboardStats, DocumentDetail, DocumentRelationSummary, DocumentSummary, DocumentTypeSummary, FileSummary, FolderNode, NotificationSummary, RelationType, VersionType } from "@docmax/shared";
import { RELATION_TYPES, nextVersionLabel } from "@docmax/shared";
import { authApi, foldersApi, documentsApi, documentTypesApi, organizationsApi, relationsApi, filesApi, notificationsApi, statsApi, ApiRequestError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n";
import Login from "./Login";
import AdminPanel from "./AdminPanel";
import CalendarView from "./CalendarView";
import GraphView from "./GraphView";

// ─── Types ──────────────────────────────────────────────────────────────────
type View = "dash" | "vault" | "doc" | "graph" | "mon" | "cal" | "admin";
type DocTab = "pdf" | "word" | "diff" | "history";

// ─── Data ────────────────────────────────────────────────────────────────────
interface FolderCardData {
  name: string;
  count: number;
  meta: string;
  accent: boolean;
  locked: boolean;
}

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

// ─── Real hujjat ma'lumotlari uchun yordamchi funksiyalar ─────────────────────
/** Backend DocStatus (DRAFT/IN_REVIEW/ACTIVE/EXPIRED) → StatusBadge kaliti. */
function docStatusToBadgeKey(status: string): string {
  return status === "IN_REVIEW" ? "review" : status.toLowerCase();
}

/** ISO sana → DD.MM.YYYY (CLAUDE.md sana formati). */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

// ─── Helper Components ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const M: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    active:  { label: t("status.active"), bg: "rgba(198,242,78,.14)", text: "#C6F24E", dot: "#C6F24E" },
    review:  { label: t("status.review"), bg: "rgba(240,194,75,.14)", text: "#F0C24B", dot: "#F0C24B" },
    expired: { label: t("status.expired"), bg: "rgba(140,150,155,.14)", text: "#8FA0A8", dot: "#8FA0A8" },
    draft:   { label: t("status.draft"), bg: "rgba(240,122,107,.14)", text: "#F07A6B", dot: "#F07A6B" },
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

// ─── Brendli fayl ikonkasi (PDF qizil / Word ko'k, buklangan burchakli varaq) ──
export function FileTypeIcon({ kind, size = 26 }: { kind: "pdf" | "docx"; size?: number }) {
  const body = kind === "pdf" ? "#E2574C" : "#2B7CD3";
  const fold = kind === "pdf" ? "#B53629" : "#1E5FA8";
  const label = kind === "pdf" ? "PDF" : "W";
  return (
    <svg width={size * (20 / 26)} height={size} viewBox="0 0 20 26" style={{ display: "block", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.25))" }}>
      {/* varaq tanasi */}
      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0H13l5 5v18.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 2 23.5V2.5Z" fill={body} />
      {/* buklangan burchak */}
      <path d="M13 0l5 5h-3.8A1.2 1.2 0 0 1 13 3.8V0Z" fill={fold} />
      {/* matn qatorlari (yorug' shtrixlar) */}
      <rect x="5" y="8" width="8" height="1.4" rx="0.7" fill="rgba(255,255,255,.45)" />
      <rect x="5" y="10.6" width="10" height="1.4" rx="0.7" fill="rgba(255,255,255,.3)" />
      <text x="10" y="21.5" textAnchor="middle" fontFamily="Sora, Manrope, sans-serif" fontWeight="800"
        fontSize={kind === "pdf" ? 6 : 8.5} fill="#fff" style={{ letterSpacing: kind === "pdf" ? 0.3 : 0 }}>
        {label}
      </text>
    </svg>
  );
}

// ─── Fayl-chip (PDF/DOCX) — hover'da ko'rish/yuklab olish/tahrirlash/o'chirish ─
// FolderTreeNode'dagi hover naqshi bilan izchil (React state, CSS group-hover emas).
function FileChip({ kind, originalName, canEdit, isDark, panelBorder, txt2, onView, onDownload, onEdit, onDelete }: {
  kind: "pdf" | "docx";
  originalName: string;
  canEdit: boolean;
  isDark: boolean;
  panelBorder: string;
  txt2: string;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span className="flex items-center cursor-default rounded-md transition-transform"
        title={originalName}
        style={{ transform: hovered ? "translateY(-1px) scale(1.06)" : "none" }}>
        <FileTypeIcon kind={kind} />
      </span>
      {hovered && (
        <div className="flex absolute z-30 items-center" style={{ left: "100%", top: "50%", transform: "translateY(-50%)", paddingLeft: 4 }}>
          <div className="flex items-center gap-0.5 rounded-[10px] p-1"
            style={{ background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}>
            <span title={t("vault.fileView")} onClick={onView}
              className="p-1.5 rounded-lg cursor-pointer transition-opacity hover:opacity-60" style={{ color: txt2 }}>
              <Eye size={13} />
            </span>
            <span title={t("vault.fileDownload")} onClick={onDownload}
              className="p-1.5 rounded-lg cursor-pointer transition-opacity hover:opacity-60" style={{ color: txt2 }}>
              <Download size={13} />
            </span>
            {canEdit && (
              <span title={t("vault.fileEdit")} onClick={onEdit}
                className="p-1.5 rounded-lg cursor-pointer transition-opacity hover:opacity-60" style={{ color: txt2 }}>
                <Pencil size={13} />
              </span>
            )}
            {canEdit && (
              <span title={t("vault.fileDelete")} onClick={onDelete}
                className="p-1.5 rounded-lg cursor-pointer transition-opacity hover:opacity-60" style={{ color: "#F07A6B" }}>
                <Trash2 size={13} />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Folder Card (macOS stacked-sheets style) ────────────────────────────────
function FolderCard({ folder, onClick }: { folder: FolderCardData; onClick: () => void }) {
  const { t } = useTranslation();
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
          {t("vault.folderMetaPlain", { count })}
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

// ─── Folder Tree Node (chap paneldagi "Papkalar" — real backend, rekursiv "+") ─
type FolderPathEntry = { id: string | null; name: string | null };

function FolderTreeNode({
  folder, depth, ancestors, activeFolderId, isAdmin, onNavigate, onChanged, toast,
  lime, txt, txt2, txt3, panel, panelBorder, isDark,
}: {
  folder: FolderNode;
  depth: number;
  ancestors: FolderPathEntry[];
  activeFolderId: string | null;
  isAdmin: boolean;
  onNavigate: (path: FolderPathEntry[]) => void;
  /** Shu tugun o'zini tahrirlagan/o'chirgandan keyin — meni o'z ichiga olgan ro'yxatni yangilash. */
  onChanged: () => void;
  toast: (msg: string) => void;
  lime: string; txt: string; txt2: string; txt3: string; panel: string; panelBorder: string; isDark: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FolderNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [editSaving, setEditSaving] = useState(false);
  const [hovered, setHovered] = useState(false);

  const path = [...ancestors, { id: folder.id, name: folder.name }];

  const loadChildren = () => {
    setLoading(true);
    foldersApi.tree({ parentId: folder.id }).then(setChildren).catch(() => setChildren([])).finally(() => setLoading(false));
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded && children === null) loadChildren();
    setExpanded((x) => !x);
  };

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await foldersApi.create({ name, parentId: folder.id });
      setCreateOpen(false);
      setCreateName("");
      if (!expanded) setExpanded(true);
      loadChildren();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.folderCreate"));
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    const name = editName.trim();
    if (!name || name === folder.name) { setEditOpen(false); setEditName(folder.name); return; }
    setEditSaving(true);
    try {
      await foldersApi.update(folder.id, { name });
      setEditOpen(false);
      onChanged();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.folderRename"));
      setEditSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t("vault.folderDeleteConfirm", { name: folder.name }))) return;
    try {
      await foldersApi.remove(folder.id);
      onChanged();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.folderDelete"));
    }
  };

  const isActive = folder.id === activeFolderId;
  const showActions = hovered && isAdmin && !editOpen;
  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt,
  };

  return (
    <div>
      <div onClick={() => !editOpen && onNavigate(path)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
          borderRadius: 11, fontSize: 13.5, fontWeight: 600, cursor: "pointer", transition: ".15s",
          background: isActive ? `${lime}18` : hovered ? (isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.045)") : "transparent",
          color: isActive ? lime : txt2,
        }}>
        <span onClick={toggle} className="flex-shrink-0" style={{ display: "grid", placeItems: "center", width: 14, height: 14 }}>
          {folder.hasChildren || children ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
        </span>
        <FolderOpen size={15} className="flex-shrink-0" />
        {editOpen ? (
          <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setEditOpen(false); setEditName(folder.name); } }}
            onBlur={handleRename}
            disabled={editSaving}
            className="flex-1 outline-none rounded px-1.5 py-0.5 min-w-0"
            style={{ background: isDark ? "rgba(255,255,255,.09)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
        ) : (
          <span className="flex-1 truncate">{folder.name}</span>
        )}
        {showActions ? (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span onClick={(e) => { e.stopPropagation(); if (!expanded) { setExpanded(true); if (children === null) loadChildren(); } setCreateOpen((o) => !o); }}
              title={t("vault.newFolder")}
              style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, color: txt3 }}>
              <Plus size={13} />
            </span>
            <span onClick={(e) => { e.stopPropagation(); setEditName(folder.name); setEditOpen(true); }}
              title={t("common.edit")}
              style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, color: txt3 }}>
              <Pencil size={12} />
            </span>
            <span onClick={handleDelete}
              title={t("common.delete")}
              style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, color: "#F07A6B" }}>
              <Trash2 size={12} />
            </span>
          </div>
        ) : !editOpen && (
          <span className="text-[11px] font-bold flex-shrink-0" style={{ color: txt3 }}>{folder.documentCount}</span>
        )}
      </div>

      {createOpen && (
        <div style={{ marginLeft: 20 + depth * 14, marginTop: 4, marginBottom: 4 }} onClick={(e) => e.stopPropagation()}>
          <input autoFocus value={createName} onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreateOpen(false); }}
            placeholder={t("vault.folderNamePlaceholder")}
            className="w-full outline-none rounded-lg text-[12px] font-semibold px-2.5 py-1.5"
            style={inputStyle} disabled={saving} />
        </div>
      )}

      {expanded && (
        <div style={{ marginLeft: 20, borderLeft: `1.5px solid ${panelBorder}`, paddingLeft: 6 }}>
          {loading ? (
            <div style={{ padding: "6px 10px", fontSize: 12, color: txt3 }}>…</div>
          ) : (
            children?.map((c) => (
              <FolderTreeNode key={c.id} folder={c} depth={depth + 1} ancestors={path}
                activeFolderId={activeFolderId} isAdmin={isAdmin} onNavigate={onNavigate} onChanged={loadChildren} toast={toast}
                lime={lime} txt={txt} txt2={txt2} txt3={txt3} panel={panel} panelBorder={panelBorder} isDark={isDark} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Graph View ───────────────────────────────────────────────────────────────
// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  const [isDark, setIsDark] = useState(true);
  const [view, setView] = useState<View>("dash");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizOpen, setWizOpen] = useState(false);
  const [wizStep, setWizStep] = useState(1);
  const [docTab, setDocTab] = useState<DocTab>("pdf");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [cmdkQuery, setCmdkQuery] = useState("");
  const [cmdkResults, setCmdkResults] = useState<DocumentSummary[]>([]);
  const [cmdkSearching, setCmdkSearching] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveFolders, setBulkMoveFolders] = useState<{ id: string; name: string; depth: number }[]>([]);
  const [vaultSeg, setVaultSeg] = useState<"table" | "card" | "timeline">("table");
  const [monFilter, setMonFilter] = useState("all");
  const [treeOpen, setTreeOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // ── Dashboard statistikasi + bildirishnomalar (TZ-2 §2.7 — real, avval mock edi) ──
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Papkalar (real backend — TZ-1 §1.2, foldersApi.tree) ──────────────────
  // name: null → ildiz daraja, breadcrumb'da t('breadcrumb.vaultRoot') orqali reaktiv tarjima qilinadi
  const [folderStack, setFolderStack] = useState<{ id: string | null; name: string | null }[]>([
    { id: null, name: null },
  ]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const currentFolder = folderStack[folderStack.length - 1];

  // Yangi papka yaratish (faqat ADMIN/SUPER_ADMIN, backend @Roles('ADMIN') bilan mos)
  const [folderCreateOpen, setFolderCreateOpen] = useState(false);
  const [folderCreateName, setFolderCreateName] = useState("");
  const [folderCreateSaving, setFolderCreateSaving] = useState(false);

  // Chap paneldagi "Papkalar" daraxti (real backend) — ildiz darajasi
  const [sidebarRoots, setSidebarRoots] = useState<FolderNode[]>([]);
  const [sidebarCreateOpen, setSidebarCreateOpen] = useState(false);
  const [sidebarCreateName, setSidebarCreateName] = useState("");
  const [sidebarCreateSaving, setSidebarCreateSaving] = useState(false);

  // ── Hujjatlar (real backend — TZ-1 §1.3, documentsApi) ─────────────────────
  const [docFilters, setDocFilters] = useState<{ status?: string; docTypeId?: string; year?: number; tag?: string }>(
    () => {
      const p = new URLSearchParams(window.location.search);
      return {
        status: p.get("status") ?? undefined,
        docTypeId: p.get("docTypeId") ?? undefined,
        year: p.get("year") ? Number(p.get("year")) : undefined,
        tag: p.get("tag") ?? undefined,
      };
    },
  );
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsTotal, setDocumentsTotal] = useState(0);

  // Admin Panel orqali yaratiladigan hujjat turlari (enum o'rniga) — wizard va filtrlar shundan foydalanadi
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeSummary[]>([]);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [docDetailLoading, setDocDetailLoading] = useState(false);
  const [docDetailError, setDocDetailError] = useState<string | null>(null);
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [statusChangeNote, setStatusChangeNote] = useState("");
  const [statusChangeDate, setStatusChangeDate] = useState("");
  const [statusChangeSaving, setStatusChangeSaving] = useState(false);

  // Hujjat metadata'sini tahrirlash (nom, raqam, tur, sana, teglar)
  const [docEditOpen, setDocEditOpen] = useState(false);
  const [docEditForm, setDocEditForm] = useState({ title: "", docNumber: "", docTypeId: "", approvedAt: "", tagsRaw: "" });

  // ── Yangi versiya modali (TZ-1 §1.4) ──
  const [verOpen, setVerOpen] = useState(false);
  const [verType, setVerType] = useState<VersionType>("MINOR");
  const [verNote, setVerNote] = useState("");
  const [verPdf, setVerPdf] = useState<FileSummary | null>(null);
  const [verDocx, setVerDocx] = useState<FileSummary | null>(null);
  const [verDiff, setVerDiff] = useState<FileSummary | null>(null);
  const [verUploading, setVerUploading] = useState<"pdf" | "docx" | "diff" | null>(null);
  const [verSaving, setVerSaving] = useState(false);
  const [tplState, setTplState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [tplFileId, setTplFileId] = useState<string | null>(null);
  const [tplFallback, setTplFallback] = useState(false);
  const tplTimer = useRef<number | null>(null);
  const verPdfInputRef = useRef<HTMLInputElement>(null);
  const verDocxInputRef = useRef<HTMLInputElement>(null);
  const verDiffInputRef = useRef<HTMLInputElement>(null);
  const [docEditSaving, setDocEditSaving] = useState(false);

  // Bog'lanishlar (TZ-2 — hujjatlarni bir-biriga bog'lash)
  const [relations, setRelations] = useState<DocumentRelationSummary[]>([]);
  const [relationAddOpen, setRelationAddOpen] = useState(false);
  const [relationSearch, setRelationSearch] = useState("");
  const [relationSearchResults, setRelationSearchResults] = useState<DocumentSummary[]>([]);
  const [relationTargetId, setRelationTargetId] = useState<string | null>(null);
  const [relationTargetTitle, setRelationTargetTitle] = useState("");
  const [relationType, setRelationType] = useState<RelationType>("RELATED");
  const [relationNote, setRelationNote] = useState("");
  const [relationSaving, setRelationSaving] = useState(false);

  // Yuklash wizard'i — haqiqiy fayl/hujjat holati
  const [pdfUpload, setPdfUpload] = useState<FileSummary | null>(null);
  const [docxUpload, setDocxUpload] = useState<FileSummary | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [docxUploading, setDocxUploading] = useState(false);
  const [wizError, setWizError] = useState<string | null>(null);
  const [wizSaving, setWizSaving] = useState(false);
  const [docForm, setDocForm] = useState({ title: "", docNumber: "", docTypeId: "", approvedAt: "", tagsRaw: "" });

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

  // Palette yopilganda qidiruv holatini tozalash (keyingi ochilishda eski natija chiqmasin)
  useEffect(() => {
    if (!cmdkOpen) { setCmdkQuery(""); setCmdkResults([]); }
  }, [cmdkOpen]);

  // ⌘K real qidiruv — nom/raqam bo'yicha, 300ms debounce (TZ-1 §1.3 / TZ-2 §2.6)
  useEffect(() => {
    if (!cmdkOpen) return;
    const q = cmdkQuery.trim();
    if (q.length < 2) { setCmdkResults([]); setCmdkSearching(false); return; }
    setCmdkSearching(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await documentsApi.list({ q, limit: 8 });
        if (!cancelled) setCmdkResults(res.items);
      } catch {
        if (!cancelled) setCmdkResults([]);
      } finally {
        if (!cancelled) setCmdkSearching(false);
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [cmdkQuery, cmdkOpen]);

  // Sahifa yuklanganda refresh cookie orqali sessiyani tiklashga urinish (FOUC'siz)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await authApi.refresh();
      if (!token) {
        if (!cancelled) useAuthStore.getState().clearSession();
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          useAuthStore.getState().setSession(me, token);
          if ((SUPPORTED_LOCALES as readonly string[]).includes(me.locale)) {
            i18n.changeLanguage(me.locale);
          }
        }
      } catch {
        if (!cancelled) useAuthStore.getState().clearSession();
      }
    })();
    return () => { cancelled = true; };
  }, [i18n]);

  // Til almashtirilganda profilida saqlanadi (login qilingan bo'lsa)
  const handleLocaleChange = useCallback((locale: SupportedLocale) => {
    i18n.changeLanguage(locale);
    if (useAuthStore.getState().user) {
      authApi.updateProfile({ locale }).catch(() => {});
    }
  }, [i18n]);

  // Hujjat turlari (Admin Panel orqali boshqariladi) — login qilingach bir marta yuklanadi
  useEffect(() => {
    if (!user) { setDocumentTypes([]); return; }
    documentTypesApi.list().then(setDocumentTypes).catch(() => {});
  }, [user]);

  // Kompaniya logotipi (Admin Panel — no-code brend sozlamasi) — Rail sidebar'da ko'rsatiladi
  useEffect(() => {
    if (!user) { setOrgLogoUrl(null); return; }
    organizationsApi.branding().then(b => setOrgLogoUrl(b.logoUrl)).catch(() => {});
  }, [user]);

  // Dashboard statistikasi (TZ-2 §2.7 — real, avval hardcoded 482/396 raqamlar edi)
  useEffect(() => {
    if (!user) { setDashboardStats(null); return; }
    statsApi.dashboard().then(setDashboardStats).catch(() => {});
  }, [user]);

  // Bildirishnomalar markazi (TZ-2 §2.7 — drawer avval to'liq mock edi)
  const refetchNotifications = useCallback(() => {
    notificationsApi.list().then((res) => { setNotifications(res.items); setUnreadCount(res.unreadCount); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadCount(0); return; }
    refetchNotifications();
  }, [user, refetchNotifications]);

  const handleMarkNotificationRead = useCallback((id: string) => {
    notificationsApi.markRead(id).then(refetchNotifications).catch(() => {});
  }, [refetchNotifications]);

  const handleMarkAllNotificationsRead = useCallback(() => {
    notificationsApi.markAllRead().then(refetchNotifications).catch(() => {});
  }, [refetchNotifications]);

  // Chap paneldagi "Papkalar" daraxti (real backend) — login qilingach ildiz darajasi yuklanadi
  const refetchSidebarRoots = useCallback(() => {
    foldersApi.tree({}).then(setSidebarRoots).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) { setSidebarRoots([]); return; }
    refetchSidebarRoots();
  }, [user, refetchSidebarRoots]);


  // Joriy papka (folderStack oxiri) o'zgarganda bolalarini yuklaydi
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setFoldersLoading(true);
    setFoldersError(null);
    foldersApi
      .tree({ parentId: currentFolder.id ?? undefined })
      .then((data) => { if (!cancelled) setFolders(data); })
      .catch((err) => {
        if (!cancelled) {
          setFoldersError(err instanceof ApiRequestError ? err.body.message : t("errors.foldersLoad"));
        }
      })
      .finally(() => { if (!cancelled) setFoldersLoading(false); });
    return () => { cancelled = true; };
  }, [user, currentFolder.id]);

  // Yaratishdan keyin ro'yxatni jimgina yangilaydi (to'liq skeleton'siz)
  const refetchFolders = useCallback(() => {
    foldersApi.tree({ parentId: currentFolder.id ?? undefined }).then(setFolders).catch(() => {});
  }, [currentFolder.id]);

  // Joriy papkadagi hujjatlar — faqat haqiqiy papka ichiga kirilganda (ildiz darajada folderId yo'q)
  useEffect(() => {
    if (!user || !currentFolder.id) {
      setDocuments([]);
      setDocumentsTotal(0);
      return;
    }
    let cancelled = false;
    setDocumentsLoading(true);
    setDocumentsError(null);
    documentsApi
      .list({ folderId: currentFolder.id, ...docFilters, limit: 50 })
      .then((res) => { if (!cancelled) { setDocuments(res.items); setDocumentsTotal(res.total); } })
      .catch((err) => {
        if (!cancelled) {
          setDocumentsError(err instanceof ApiRequestError ? err.body.message : t("errors.documentsLoad"));
        }
      })
      .finally(() => { if (!cancelled) setDocumentsLoading(false); });
    return () => { cancelled = true; };
  }, [user, currentFolder.id, docFilters]);

  // Filtrlar URL'da saqlanadi va tiklanadi (TZ-1 §1.3 qabul mezoni)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    (["status", "docTypeId", "year", "tag"] as const).forEach((key) => {
      const value = docFilters[key];
      if (value) p.set(key, String(value)); else p.delete(key);
    });
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [docFilters]);

  /** docFilters'dagi bitta o'lchamni bosilganda yoqadi/o'chiradi (kombinatsiyalanadigan filtrlar). */
  const toggleDocFilter = useCallback(
    <K extends keyof typeof docFilters>(key: K, value: (typeof docFilters)[K]) => {
      setDocFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
    },
    [],
  );

  const refetchDocuments = useCallback(() => {
    if (!currentFolder.id) return;
    documentsApi
      .list({ folderId: currentFolder.id, ...docFilters, limit: 50 })
      .then((res) => { setDocuments(res.items); setDocumentsTotal(res.total); })
      .catch(() => {});
  }, [currentFolder.id, docFilters]);

  // Tanlangan hujjat detali
  useEffect(() => {
    if (!selectedDocId) { setDocDetail(null); return; }
    let cancelled = false;
    setDocDetailLoading(true);
    setDocDetailError(null);
    documentsApi
      .get(selectedDocId)
      .then((data) => { if (!cancelled) setDocDetail(data); })
      .catch((err) => {
        if (!cancelled) {
          setDocDetailError(err instanceof ApiRequestError ? err.body.message : t("errors.docDetailLoad"));
        }
      })
      .finally(() => { if (!cancelled) setDocDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDocId]);

  // Bog'lanishlar — tanlangan hujjat o'zgarganda yuklanadi va qo'shish formasi tozalanadi
  const refetchRelations = useCallback(() => {
    if (!selectedDocId) { setRelations([]); return; }
    relationsApi.list(selectedDocId).then(setRelations).catch(() => {});
  }, [selectedDocId]);

  useEffect(() => {
    refetchRelations();
    setRelationAddOpen(false);
    setRelationSearch("");
    setRelationSearchResults([]);
    setRelationTargetId(null);
    setRelationTargetTitle("");
    setRelationNote("");
    setRelationType("RELATED");
  }, [selectedDocId, refetchRelations]);

  // DocDetail audit paneli (TZ-2 §2.7 — avval mock edi)
  const [docAuditLog, setDocAuditLog] = useState<AuditLogEntry[]>([]);
  useEffect(() => {
    if (!selectedDocId) { setDocAuditLog([]); return; }
    documentsApi.audit(selectedDocId).then((res) => setDocAuditLog(res.items)).catch(() => setDocAuditLog([]));
  }, [selectedDocId]);

  // Bog'lanish qo'shish formasida hujjat nomi/raqami bo'yicha qidiruv
  useEffect(() => {
    if (!relationAddOpen || relationSearch.trim().length < 2) { setRelationSearchResults([]); return; }
    let cancelled = false;
    documentsApi.list({ q: relationSearch.trim(), limit: 8 })
      .then((res) => { if (!cancelled) setRelationSearchResults(res.items.filter(d => d.id !== selectedDocId)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [relationAddOpen, relationSearch, selectedDocId]);

  const handleLogout = useCallback(async () => {
    setUserMenuOpen(false);
    try {
      await authApi.logout();
    } catch {
      // token allaqachon yaroqsiz bo'lishi mumkin — baribir sessiyani lokal tozalaymiz
    }
    useAuthStore.getState().clearSession();
  }, []);

  const toast = useCallback((msg: string) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400);
  }, []);

  const handleCreateFolder = useCallback(async () => {
    const name = folderCreateName.trim();
    if (!name) return;
    setFolderCreateSaving(true);
    try {
      await foldersApi.create({ name, parentId: currentFolder.id });
      setFolderCreateOpen(false);
      setFolderCreateName("");
      refetchFolders();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.folderCreate"));
    } finally {
      setFolderCreateSaving(false);
    }
  }, [folderCreateName, currentFolder.id, refetchFolders, toast]);

  const goView = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };

  const handleSidebarNavigate = useCallback((path: FolderPathEntry[]) => {
    setFolderStack(path);
    goView("vault");
  }, []);

  const handleSidebarCreate = useCallback(async () => {
    const name = sidebarCreateName.trim();
    if (!name) return;
    setSidebarCreateSaving(true);
    try {
      await foldersApi.create({ name, parentId: null });
      setSidebarCreateOpen(false);
      setSidebarCreateName("");
      refetchSidebarRoots();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.folderCreate"));
    } finally {
      setSidebarCreateSaving(false);
    }
  }, [sidebarCreateName, refetchSidebarRoots, toast]);

  const handleAddRelation = useCallback(async () => {
    if (!selectedDocId || !relationTargetId) return;
    setRelationSaving(true);
    try {
      await relationsApi.create(selectedDocId, { targetDocumentId: relationTargetId, type: relationType, note: relationNote.trim() || null });
      setRelationAddOpen(false);
      setRelationSearch("");
      setRelationSearchResults([]);
      setRelationTargetId(null);
      setRelationTargetTitle("");
      setRelationNote("");
      setRelationType("RELATED");
      refetchRelations();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.relationAdd"));
    } finally {
      setRelationSaving(false);
    }
  }, [selectedDocId, relationTargetId, relationType, relationNote, refetchRelations, toast]);

  const handleRemoveRelation = useCallback(async (relationId: string) => {
    if (!selectedDocId) return;
    try {
      await relationsApi.remove(selectedDocId, relationId);
      refetchRelations();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.generic"));
    }
  }, [selectedDocId, refetchRelations, toast]);

  const toggleDoc = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () =>
    setSelected(selected.size === documents.length ? new Set() : new Set(documents.map(d => d.id)));

  const openDocument = (id: string) => { setSelectedDocId(id); goView("doc"); };

  // ── Wizard handlerlari (real upload + hujjat yaratish, TZ-1 §1.3) ─────────
  const openWizard = useCallback(() => {
    if (!currentFolder.id) {
      toast(t("wizard.noFolderSelected"));
      return;
    }
    if (documentTypes.length === 0) {
      toast(t("wizard.noDocumentTypes"));
      return;
    }
    setPdfUpload(null);
    setDocxUpload(null);
    setWizError(null);
    setDocForm({ title: "", docNumber: "", docTypeId: documentTypes[0].id, approvedAt: "", tagsRaw: "" });
    setWizStep(1);
    setWizOpen(true);
  }, [currentFolder.id, documentTypes, t, toast]);

  const handlePickFile = useCallback(async (kind: "pdf" | "docx", file: File) => {
    const expectedMime = kind === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (file.type !== expectedMime) {
      setWizError(kind === "pdf" ? t("errors.pdfOnly") : t("errors.docxOnly"));
      return;
    }
    const setUploading = kind === "pdf" ? setPdfUploading : setDocxUploading;
    const setUpload = kind === "pdf" ? setPdfUpload : setDocxUpload;
    setUploading(true);
    setWizError(null);
    try {
      const result = await filesApi.upload(file);
      setUpload(result);
    } catch (err) {
      setWizError(err instanceof ApiRequestError ? err.body.message : t("errors.fileUpload"));
    } finally {
      setUploading(false);
    }
  }, []);

  const handleWizardSave = useCallback(async () => {
    if (!currentFolder.id || !pdfUpload) return;
    setWizSaving(true);
    setWizError(null);
    try {
      const created = await documentsApi.create({
        folderId: currentFolder.id,
        title: docForm.title,
        docNumber: docForm.docNumber || null,
        docTypeId: docForm.docTypeId,
        approvedAt: docForm.approvedAt ? new Date(docForm.approvedAt) : null,
        pdfFileId: pdfUpload.id,
        docxFileId: docxUpload?.id ?? null,
        tagNames: docForm.tagsRaw.split(",").map(s => s.trim()).filter(Boolean),
      });
      setWizOpen(false);
      refetchDocuments();
      openDocument(created.id);
    } catch (err) {
      setWizError(err instanceof ApiRequestError ? err.body.message : t("errors.docSave"));
    } finally {
      setWizSaving(false);
    }
  }, [currentFolder.id, pdfUpload, docxUpload, docForm, refetchDocuments]);

  // ── Holat o'zgartirish (TZ-1 §1.3 — EXPIRED qilishda sabab so'raladi) ──────
  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!docDetail) return;
    if (newStatus === "EXPIRED") {
      setStatusChangeOpen(true);
      return;
    }
    try {
      const updated = await documentsApi.update(docDetail.id, { status: newStatus as never });
      setDocDetail(updated);
      refetchDocuments();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.generic"));
    }
  }, [docDetail, refetchDocuments, toast]);

  const confirmExpire = useCallback(async () => {
    if (!docDetail || !statusChangeDate || !statusChangeNote) return;
    setStatusChangeSaving(true);
    try {
      const updated = await documentsApi.update(docDetail.id, {
        status: "EXPIRED" as never,
        effectiveTo: new Date(statusChangeDate),
        statusChangeNote,
      });
      setDocDetail(updated);
      refetchDocuments();
      setStatusChangeOpen(false);
      setStatusChangeNote("");
      setStatusChangeDate("");
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.generic"));
    } finally {
      setStatusChangeSaving(false);
    }
  }, [docDetail, statusChangeDate, statusChangeNote, refetchDocuments, toast]);

  // ── Hujjat metadata'sini tahrirlash (nom, raqam, tur, sana, teglar) ────────
  const openDocEdit = useCallback(() => {
    if (!docDetail) return;
    setDocEditForm({
      title: docDetail.title,
      docNumber: docDetail.docNumber ?? "",
      docTypeId: docDetail.docTypeId,
      approvedAt: docDetail.approvedAt ? docDetail.approvedAt.slice(0, 10) : "",
      tagsRaw: docDetail.tags.join(", "),
    });
    setDocEditOpen(true);
  }, [docDetail]);

  const handleSaveDocEdit = useCallback(async () => {
    if (!docDetail || !docEditForm.title.trim()) return;
    setDocEditSaving(true);
    try {
      const updated = await documentsApi.update(docDetail.id, {
        title: docEditForm.title.trim(),
        docNumber: docEditForm.docNumber.trim() || null,
        docTypeId: docEditForm.docTypeId,
        approvedAt: docEditForm.approvedAt ? new Date(docEditForm.approvedAt) : null,
        tagNames: docEditForm.tagsRaw.split(",").map(s => s.trim()).filter(Boolean),
      });
      setDocDetail(updated);
      refetchDocuments();
      setDocEditOpen(false);
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.docSave"));
    } finally {
      setDocEditSaving(false);
    }
  }, [docDetail, docEditForm, refetchDocuments, toast]);

  // ── Jadvaldagi fayl-chip amallari (PDF/DOCX hover: ko'rish/yuklab olish/tahrirlash/o'chirish) ──
  const handleFileOpen = useCallback(async (fileId: string, disposition: "inline" | "attachment") => {
    try {
      // URL bosilgan paytda yangidan olinadi — ro'yxatga kiritilgan presigned URL 10 daqiqada eskirar edi
      const { url } = await filesApi.downloadUrl(fileId, disposition);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.fileOpen"));
    }
  }, [toast]);

  const autoEditDocRef = useRef(false);
  const handleDocEditFromTable = (id: string) => {
    autoEditDocRef.current = true;
    openDocument(id);
  };
  useEffect(() => {
    if (docDetail && autoEditDocRef.current) {
      autoEditDocRef.current = false;
      if (user?.role === "ADMIN" || user?.role === "EDITOR") openDocEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docDetail]);

  const handleDocDeleteFromTable = useCallback(async (doc: DocumentSummary) => {
    if (!window.confirm(`${t("vault.deleteDocConfirm")} "${doc.title}"?`)) return;
    try {
      await documentsApi.remove(doc.id);
      toast(t("vault.docDeleted"));
      refetchDocuments();
      refetchFolders();
      refetchSidebarRoots();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.docDelete"));
    }
  }, [t, toast, refetchDocuments, refetchFolders, refetchSidebarRoots]);

  // ── Bulk amallar (Vault tanlash bar) ──
  const runBulkAndRefresh = useCallback(async (fn: () => Promise<void>) => {
    setBulkBusy(true);
    try {
      await fn();
      setSelected(new Set());
      refetchDocuments();
      refetchFolders();
      refetchSidebarRoots();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.bulkAction"));
    } finally {
      setBulkBusy(false);
    }
  }, [toast, refetchDocuments, refetchFolders, refetchSidebarRoots]);

  const handleBulkDelete = () => {
    if (!window.confirm(t("bulkBar.deleteConfirm", { count: selected.size }))) return;
    void runBulkAndRefresh(async () => {
      const res = await documentsApi.bulk({ action: "delete", documentIds: [...selected] });
      toast(t("bulkBar.deletedToast", { count: res.affected }));
    });
  };

  const handleBulkTagSubmit = () => {
    const name = bulkTagValue.trim();
    if (!name) return;
    setBulkTagOpen(false);
    setBulkTagValue("");
    void runBulkAndRefresh(async () => {
      const res = await documentsApi.bulk({ action: "tag", documentIds: [...selected], tagName: name });
      toast(t("bulkBar.taggedToast", { count: res.affected }));
    });
  };

  const openBulkMove = async () => {
    setBulkMoveOpen(true);
    // Butun papka daraxtini yassi (chekinishli) ro'yxatga yig'ish
    const flat: { id: string; name: string; depth: number }[] = [];
    const walk = async (parentId: string | null, depth: number) => {
      const nodes = await foldersApi.tree({ parentId });
      for (const n of nodes) {
        flat.push({ id: n.id, name: n.name, depth });
        if (n.hasChildren) await walk(n.id, depth + 1);
      }
    };
    try {
      await walk(null, 0);
      setBulkMoveFolders(flat);
    } catch {
      setBulkMoveFolders([]);
    }
  };

  const handleBulkMoveTo = (folderId: string) => {
    setBulkMoveOpen(false);
    void runBulkAndRefresh(async () => {
      const res = await documentsApi.bulk({ action: "move", documentIds: [...selected], folderId });
      toast(t("bulkBar.movedToast", { count: res.affected }));
    });
  };

  const handleBulkDownload = async () => {
    // Klient tomonlama ketma-ket yuklab olish (server ZIP o'rniga — soddaroq, DOWNLOAD audit har fayl uchun)
    const chosen = documents.filter(d => selected.has(d.id));
    for (const doc of chosen) {
      const fileRef = doc.pdfFile ?? doc.docxFile;
      if (!fileRef) continue;
      try {
        const { url } = await filesApi.downloadUrl(fileRef.id, "attachment");
        const a = document.createElement("a");
        a.href = url;
        a.download = fileRef.originalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise(r => setTimeout(r, 400));
      } catch { /* bitta fayl xatosi qolganini to'xtatmaydi */ }
    }
    toast(t("bulkBar.downloadStarted", { count: chosen.length }));
  };

  const stopTplPolling = useCallback(() => {
    if (tplTimer.current) {
      window.clearTimeout(tplTimer.current);
      tplTimer.current = null;
    }
  }, []);

  const openVersionModal = () => {
    setVerType("MINOR");
    setVerNote("");
    setVerPdf(null);
    setVerDocx(null);
    setVerDiff(null);
    setTplState("idle");
    setTplFileId(null);
    setTplFallback(false);
    setVerOpen(true);
  };

  const closeVersionModal = () => {
    stopTplPolling();
    setVerOpen(false);
  };

  /** Shablon generatsiyasi — fon vazifa (diff.generate), 1.5s polling bilan kutiladi. */
  async function startTemplateGeneration() {
    if (!docDetail) return;
    stopTplPolling();
    setTplState("running");
    setTplFileId(null);
    try {
      const { jobId } = await documentsApi.requestComparisonTemplate(docDetail.id, { versionType: verType });
      const poll = async () => {
        try {
          const st = await documentsApi.templateJobStatus(jobId);
          if (st.state === "completed" && st.fileId) {
            setTplState("done");
            setTplFileId(st.fileId);
            setTplFallback(Boolean(st.fromPdfFallback));
            return;
          }
          if (st.state === "failed") {
            setTplState("failed");
            return;
          }
          tplTimer.current = window.setTimeout(poll, 1500);
        } catch {
          setTplState("failed");
        }
      };
      tplTimer.current = window.setTimeout(poll, 1200);
    } catch (err) {
      setTplState("failed");
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.templateRequest"));
    }
  }

  async function handleVersionFile(kind: "pdf" | "docx" | "diff", file: File) {
    setVerUploading(kind);
    try {
      const summary = await filesApi.upload(file);
      if (kind === "pdf") setVerPdf(summary);
      else if (kind === "docx") setVerDocx(summary);
      else setVerDiff(summary);
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.versionFileUpload"));
    } finally {
      setVerUploading(null);
    }
  }

  async function saveNewVersion() {
    if (!docDetail || !verPdf) return;
    setVerSaving(true);
    try {
      const updated = await documentsApi.createVersion(docDetail.id, {
        versionType: verType,
        pdfFileId: verPdf.id,
        docxFileId: verDocx?.id ?? null,
        diffFileId: verDiff?.id ?? null,
        note: verNote.trim() || null,
      });
      setDocDetail(updated);
      refetchDocuments();
      closeVersionModal();
      toast(t("version.created", { label: updated.currentVersionLabel ?? "" }));
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.versionCreate"));
    } finally {
      setVerSaving(false);
    }
  }

    // Word (.docx) preview — mammoth orqali client-side HTML'ga o'giriladi
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const currentVersion = docDetail?.versions[0] ?? null;
  useEffect(() => {
    if (docTab !== "word" || !currentVersion?.docx) { setWordHtml(null); return; }
    let cancelled = false;
    setWordLoading(true);
    fetch(currentVersion.docx.downloadUrl)
      .then(res => res.arrayBuffer())
      .then(buf => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then(result => { if (!cancelled) setWordHtml(result.value); })
      .catch(() => { if (!cancelled) setWordHtml(null); })
      .finally(() => { if (!cancelled) setWordLoading(false); });
    return () => { cancelled = true; };
  }, [docTab, currentVersion]);

  // Breadcrumb map — vault/doc joriy papka/hujjat nomi bilan dinamik, boshqalari sof chrome
  const crumbs: Record<View, string> = {
    dash: t("breadcrumb.dash"),
    vault: currentFolder.name ? `${t("breadcrumb.vaultRoot")} / ${currentFolder.name}` : t("breadcrumb.vaultRoot"),
    doc: docDetail ? `${t("breadcrumb.vaultRoot")} / ${docDetail.title}` : t("breadcrumb.vaultRoot"),
    graph: t("breadcrumb.graph"),
    mon: t("breadcrumb.mon"),
    cal: t("breadcrumb.cal"),
    admin: t("admin.title"),
  };

  // Glass card style helper
  const glass = (extra?: string) => ({
    background: panel,
    border: `1px solid ${panelBorder}`,
    backdropFilter: "blur(16px)",
    borderRadius: 20,
    ...(extra ? {} : {}),
  } as React.CSSProperties);

  const RELATION_TYPE_STYLE: Record<RelationType, { color: string; bg: string }> = {
    BASED_ON: { color: lime, bg: `${lime}18` },
    PARENT_CHILD: { color: "#6BB4F5", bg: "rgba(107,180,245,.15)" },
    AMENDS: { color: "#F0C24B", bg: "rgba(240,194,75,.15)" },
    REPLACES: { color: "#F07A6B", bg: "rgba(240,122,107,.15)" },
    RELATED: { color: "#B39CF5", bg: "rgba(179,156,245,.15)" },
  };

  // ── Sidebar Rail ──────────────────────────────────────────────────────────
  const railItems: { id?: View; icon: React.ReactNode; pip?: boolean }[] = [
    { id: "dash", icon: <LayoutDashboard size={19} /> },
    { id: "vault", icon: <FolderOpen size={19} /> },
    { id: "graph", icon: <Network size={19} /> },
    { id: "mon", icon: <Activity size={19} />, pip: true },
    { id: "cal", icon: <CalendarDays size={19} /> },
    { icon: <GitBranch size={19} /> },
  ];

  // ── Sidebar (Rail + Papkalar paneli birlashgan holda, tepasida umumiy brend header) ──
  const Sidebar = (
    <aside className="w-[68px] md:w-[310px]" style={{
      background: panel, backdropFilter: "blur(18px)",
      borderRight: `1px solid ${panelBorder}`,
      display: "flex", flexDirection: "column",
      position: "sticky", top: 0, height: "100vh", zIndex: 20, flexShrink: 0,
    }}>
      {/* Brend header — korxona logotipi (Admin Panel'dan no-code, faqat o'rnatilgan bo'lsa) tepada,
          uning ostida DocMax ikonka + matn. Ikkalasi ham Rail+Papkalar ustunlarini birlashtirgan
          to'liq kenglikda ("uzun") joylashadi. */}
      <div style={{ padding: "16px 14px 14px", borderBottom: `1px solid ${panelBorder}` }}>
        {orgLogoUrl && (
          <div className="hidden md:block" style={{ marginBottom: 12 }}>
            <img src={orgLogoUrl} alt="Logo" style={{ width: "100%", maxHeight: 56, objectFit: "contain" }} />
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: lime,
            display: "grid", placeItems: "center", flexShrink: 0,
            boxShadow: `0 6px 18px ${lime}55`,
          }}>
            <FolderOpen size={16} color="#0A1600" />
          </div>
          <span className="hidden md:inline font-['Sora']" style={{ fontWeight: 700, fontSize: 15, color: txt }}>DocMax</span>
        </div>
      </div>

      <div className="flex flex-1" style={{ minHeight: 0 }}>
        {/* Rail — ikonka ustuni (68px) */}
        <div style={{
          width: 68, display: "flex", flexDirection: "column", alignItems: "center",
          padding: "14px 0", gap: 8, flexShrink: 0,
        }}>
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

          <div onClick={() => {
            const cur = i18n.language as SupportedLocale;
            const idx = SUPPORTED_LOCALES.indexOf(cur);
            handleLocaleChange(SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length]);
          }} title={i18n.language.toUpperCase()} style={{
            width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center",
            cursor: "pointer", color: txt2, transition: ".2s", fontSize: 11, fontWeight: 800,
          }}>
            {i18n.language.toUpperCase()}
          </div>

          <div onClick={() => setIsDark(d => !d)} style={{
            width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center",
            cursor: "pointer", color: txt2, transition: ".2s",
          }}>
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </div>
          {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
            <div onClick={() => goView("admin")} style={{
              width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center",
              cursor: "pointer", transition: ".2s",
              background: view === "admin" ? `${lime}22` : "transparent",
              color: view === "admin" ? lime : txt2,
            }}>
              <Settings size={19} />
            </div>
          )}
        </div>

        {/* Papkalar paneli — 242px, faqat md+ ekranlarda */}
        <div className="hidden md:block" style={{
          width: 242, borderLeft: `1px solid ${panelBorder}`,
          padding: "20px 14px", overflowY: "auto", flexShrink: 0,
        }}>
          <div className="flex items-center justify-between mb-2.5 px-2 mt-0">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: txt3, letterSpacing: ".4px" }}>{t("vault.treeFolders")}</p>
            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
              <span onClick={() => setSidebarCreateOpen(o => !o)} title={t("vault.newFolder")}
                className="cursor-pointer" style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, color: txt3 }}>
                <Plus size={13} />
              </span>
            )}
          </div>

          {sidebarCreateOpen && (
            <div className="mb-2 px-2">
              <input autoFocus value={sidebarCreateName} onChange={e => setSidebarCreateName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSidebarCreate(); if (e.key === "Escape") setSidebarCreateOpen(false); }}
                placeholder={t("vault.folderNamePlaceholder")}
                className="w-full outline-none rounded-lg text-[12px] font-semibold px-2.5 py-1.5"
                style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }}
                disabled={sidebarCreateSaving} />
            </div>
          )}

          {sidebarRoots.map(f => (
            <FolderTreeNode key={f.id} folder={f} depth={0} ancestors={[{ id: null, name: null }]}
              activeFolderId={currentFolder.id} isAdmin={user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"}
              onNavigate={handleSidebarNavigate} onChanged={refetchSidebarRoots} toast={toast}
              lime={lime} txt={txt} txt2={txt2} txt3={txt3} panel={panel} panelBorder={panelBorder} isDark={isDark} />
          ))}

          <p className="text-[12.5px] font-semibold uppercase tracking-wide mt-4 mb-2.5 px-2" style={{ color: txt3, letterSpacing: ".4px" }}>{t("vault.savedFilters")}</p>
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
        </div>
      </div>
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
        <span className="flex-1">{t("topbar.searchPlaceholder")}</span>
        <kbd className="text-[10px] font-bold px-1.5 py-0.5 rounded-[5px]"
          style={{ border: `1px solid ${panelBorder}`, color: txt3 }}>⌘K</kbd>
      </div>

      <button onClick={() => setDrawerOpen(true)}
        className="relative flex items-center gap-2 font-bold text-[12.5px] transition-all cursor-pointer"
        style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 13, padding: "9px 14px", color: txt2 }}>
        {unreadCount > 0 && <span className="absolute top-[7px] right-[9px] w-[7px] h-[7px] rounded-full" style={{ background: "#F07A6B" }} />}
        <Bell size={16} />
      </button>

      <button onClick={openWizard}
        className="flex items-center gap-2 font-bold text-[12.5px] cursor-pointer transition-all"
        style={{ background: lime, color: "#0A1600", border: "none", borderRadius: 13, padding: "9px 14px", boxShadow: `0 8px 22px ${lime}44` }}>
        <Plus size={15} /> {t("topbar.newDocument")}
      </button>

      <div className="relative flex-shrink-0">
        <button onClick={() => setUserMenuOpen(o => !o)}
          className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-[13px] cursor-pointer border-none"
          style={{ background: `linear-gradient(135deg, ${lime}, #2FA45B)`, color: "#0A1600" }}>
          {user ? user.fullName.trim().split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase() : ""}
        </button>
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-[85]" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-[86] text-[12.5px]"
              style={{ width: 220, background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, borderRadius: 14, padding: 12, boxShadow: "0 20px 50px rgba(0,0,0,.45)" }}>
              <p className="font-bold truncate" style={{ color: txt }}>{user?.fullName}</p>
              <p className="font-semibold mb-2.5 truncate" style={{ color: txt3, fontSize: 11.5 }}>{user?.email}</p>
              <button onClick={handleLogout}
                className="w-full text-left font-bold px-2.5 py-2 rounded-[10px] cursor-pointer border-none"
                style={{ color: "#F07A6B", background: "transparent" }}>
                {t("topbar.logout")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  const activityEntityLabel = (entityType: string): string => {
    const key = `dashboard.entity.${entityType}`;
    const translated = t(key);
    return translated === key ? entityType : translated;
  };
  const activityActionLabel = (action: string): string => {
    const key = `dashboard.action.${action}`;
    const translated = t(key);
    return translated === key ? action : translated;
  };

  const Dashboard = (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: txt }}>
            {t("dashboard.welcome")}{user ? `, ${user.fullName}` : ""}
          </h1>
          <p className="text-sm mt-1" style={{ color: txt2 }}>
            {t("dashboard.todaySummary", {
              newExternalActs: dashboardStats?.newExternalActs ?? 0,
              pendingApproval: dashboardStats?.pendingApproval ?? 0,
            })}
          </p>
        </div>
      </div>

      {/* Fan visualization */}
      <div className="relative mb-6 overflow-hidden" style={{ height: 220, borderRadius: 20, background: isDark ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}` }}>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 text-[11.5px] font-bold whitespace-nowrap"
          style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: "7px 14px", backdropFilter: "blur(14px)", color: txt2 }}>
          {t("dashboard.totalPrefix")} <strong style={{ color: lime }}>{t("vault.folderMetaPlain", { count: dashboardStats?.totalDocuments ?? 0 })}</strong> · {t("dashboard.totalFolders", { count: dashboardStats?.totalFolders ?? 0 })}
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
          {
            label: t("dashboard.statActiveDocs"), num: String(dashboardStats?.activeDocuments ?? 0),
            sub: <><strong style={{ color: lime }}>+{dashboardStats?.activeDocumentsThisMonth ?? 0}</strong> {t("dashboard.statThisMonth")}</>,
            dotColor: lime,
          },
          {
            label: t("dashboard.statPendingApproval"), num: String(dashboardStats?.pendingApproval ?? 0),
            sub: t("dashboard.pendingOverdue", { count: dashboardStats?.pendingApprovalOverdue ?? 0 }),
            dotColor: "#F0C24B",
          },
          {
            label: t("dashboard.statNewExternalActs"), num: String(dashboardStats?.newExternalActs ?? 0),
            sub: "cbu.uz · lex.uz", dotColor: "#6BB4F5",
          },
          {
            label: t("dashboard.statReviewSuggested"), num: "0",
            sub: t("dashboard.monitoringPending"), dotColor: "#F07A6B",
          },
        ].map((stat, i) => (
          <div key={i} style={{ ...glass(), padding: "18px 20px" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: stat.dotColor }} />
              <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: txt3 }}>{stat.label}</span>
            </div>
            <p className="font-['Sora'] text-[28px] font-semibold tracking-tight" style={{ color: txt }}>{stat.num}</p>
            <p className="text-[11.5px] font-semibold mt-1" style={{ color: txt2 }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Activity + Attention 2-col */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        {/* Activity feed */}
        <div style={{ ...glass(), padding: "20px 22px" }}>
          <h2 className="font-['Sora'] text-[15px] font-semibold mb-4" style={{ color: txt }}>{t("dashboard.recentActivity")}</h2>
          {dashboardStats?.recentActivity.length ? dashboardStats.recentActivity.map((row, i) => {
            const iconByAction: Record<string, { icon: JSX.Element; bg: string; color: string }> = {
              CREATE: { icon: <Plus size={15} />, bg: `${lime}22`, color: lime },
              UPDATE: { icon: <Clock size={15} />, bg: "rgba(240,194,75,.13)", color: "#F0C24B" },
              DELETE: { icon: <Trash2 size={15} />, bg: "rgba(240,122,107,.13)", color: "#F07A6B" },
              RESTORE: { icon: <Check size={15} />, bg: `${lime}22`, color: lime },
            };
            const cfg = iconByAction[row.action] ?? { icon: <Activity size={15} />, bg: "rgba(107,180,245,.13)", color: "#6BB4F5" };
            return (
              <div key={row.id} className="flex gap-3 py-2.5 items-start" style={{ borderBottom: i < dashboardStats.recentActivity.length - 1 ? `1px solid ${panelBorder}` : "none", fontSize: 12.5 }}>
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p style={{ color: txt }}><strong>{activityEntityLabel(row.entityType)}</strong> {activityActionLabel(row.action)}</p>
                  {row.userName && <p className="mt-0.5 font-semibold" style={{ color: txt2 }}>{row.userName}</p>}
                </div>
                <span className="text-[11px] font-bold whitespace-nowrap flex-shrink-0" style={{ color: txt3 }}>{formatDate(row.createdAt)}</span>
              </div>
            );
          }) : (
            <p className="text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("dashboard.noActivity")}</p>
          )}
        </div>

        {/* Attention cards — joriy user'ning o'qilmagan bildirishnomalari */}
        <div style={{ ...glass(), padding: "20px 22px" }}>
          <h2 className="font-['Sora'] text-[15px] font-semibold mb-4" style={{ color: txt }}>{t("dashboard.needsAttention")}</h2>
          {notifications.filter(n => !n.isRead).length === 0 ? (
            <p className="text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("dashboard.noAttention")}</p>
          ) : notifications.filter(n => !n.isRead).slice(0, 5).map((notif) => (
            <div key={notif.id} className="rounded-[13px] mb-2.5 text-[12.5px]"
              style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}`, padding: "12px 14px" }}>
              <p className="flex items-center gap-2 font-bold mb-1" style={{ color: txt }}>
                <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: lime }} />
                {notif.title}
              </p>
              <p className="font-semibold leading-relaxed" style={{ color: txt2 }}>{notif.body}</p>
              <span onClick={() => {
                handleMarkNotificationRead(notif.id);
                const docId = notif.meta.documentId;
                if (typeof docId === "string") openDocument(docId);
              }} className="inline-block mt-2 text-[11px] font-extrabold cursor-pointer" style={{ color: lime }}>
                {t("dashboard.viewNotification")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── VAULT ─────────────────────────────────────────────────────────────────
  const canEditDocuments = user?.role === "ADMIN" || user?.role === "EDITOR";
  const Vault = (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: txt }}>
            {currentFolder.name ?? t("breadcrumb.vaultRoot")}
          </h1>
          <p className="text-sm mt-1" style={{ color: txt2 }}>
            {currentFolder.id ? t("vault.folderMetaPlain", { count: documentsTotal }) : ""}
          </p>
        </div>
        <div className="flex p-1 gap-0.5" style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 10 }}>
          {[
            { value: "table" as const, label: t("vault.segmentTable") },
            { value: "card" as const, label: t("vault.segmentCard") },
            { value: "timeline" as const, label: t("vault.segmentTimeline") },
          ].map(s => (
            <span key={s.value} onClick={() => setVaultSeg(s.value)}
              className="text-[11px] font-extrabold px-3 py-[5px] rounded-lg cursor-pointer"
              style={vaultSeg === s.value
                ? { background: isDark ? "rgba(255,255,255,.12)" : "#fff", color: txt }
                : { color: txt3 }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Filter chips — har biri mustaqil o'lcham, kombinatsiyalanadi va URL'da saqlanadi */}
      <div className="flex gap-2 flex-wrap items-center mb-5">
        {[
          { active: !docFilters.status && !docFilters.docTypeId && !docFilters.year && !docFilters.tag, label: t("vault.filterAll"), onClick: () => setDocFilters({}) },
          { active: docFilters.status === "ACTIVE", label: t("vault.filterActive"), onClick: () => toggleDocFilter("status", "ACTIVE") },
          { active: docFilters.status === "EXPIRED", label: t("vault.filterExpired"), onClick: () => toggleDocFilter("status", "EXPIRED") },
          { active: docFilters.status === "DRAFT", label: t("vault.filterDraft"), onClick: () => toggleDocFilter("status", "DRAFT") },
          { active: docFilters.year === 2026, label: "2026", onClick: () => toggleDocFilter("year", 2026) },
          { active: docFilters.year === 2025, label: "2025", onClick: () => toggleDocFilter("year", 2025) },
          { active: docFilters.tag === "CBU", label: "Teg: CBU", onClick: () => toggleDocFilter("tag", "CBU") },
        ].map(c => (
          <button key={c.label} onClick={c.onClick}
            className="text-[12px] font-bold px-3.5 py-1.5 rounded-full cursor-pointer transition-all"
            style={c.active
              ? { background: `${lime}22`, border: `1px solid ${lime}55`, color: lime }
              : { background: panel, border: `1px solid ${panelBorder}`, color: txt2, backdropFilter: "blur(10px)" }}>
            {c.label}
          </button>
        ))}
        {documentTypes.length > 0 && (
          <select value={docFilters.docTypeId ?? ""} onChange={e => setDocFilters(f => ({ ...f, docTypeId: e.target.value || undefined }))}
            className="text-[12px] font-bold px-3 py-1.5 rounded-full cursor-pointer"
            style={docFilters.docTypeId
              ? { background: `${lime}22`, border: `1px solid ${lime}55`, color: lime }
              : { background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
            <option value="">{t("vault.colType")}</option>
            {documentTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
          </select>
        )}
      </div>

      {/* Papka breadcrumb (real backend) */}
      {folderStack.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3 text-[12px] font-bold flex-wrap">
          {folderStack.map((crumb, i) => (
            <span key={crumb.id ?? "root"} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} style={{ color: txt3 }} />}
              <span onClick={() => setFolderStack(s => s.slice(0, i + 1))}
                className="cursor-pointer"
                style={{ color: i === folderStack.length - 1 ? txt : txt3 }}>
                {crumb.name ?? t("breadcrumb.vaultRoot")}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Yangi papka yaratish — faqat ADMIN/SUPER_ADMIN (backend @Roles('ADMIN') bilan mos) */}
      {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
        <div className="mb-4">
          {folderCreateOpen ? (
            <div className="rounded-[14px] p-4" style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}`, maxWidth: 340 }}>
              <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>
                {t("vault.folderNameLabel")}
              </label>
              <input autoFocus value={folderCreateName} onChange={e => setFolderCreateName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); }}
                placeholder={t("vault.folderNamePlaceholder")}
                className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3 mb-3"
                style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setFolderCreateOpen(false); setFolderCreateName(""); }}
                  className="text-[12.5px] font-bold px-3.5 py-2 rounded-xl cursor-pointer"
                  style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>
                  {t("common.cancel")}
                </button>
                <button onClick={handleCreateFolder} disabled={!folderCreateName.trim() || folderCreateSaving}
                  className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                  style={{ background: lime, color: "#0A1600", border: "none" }}>
                  {folderCreateSaving && <Loader2 size={13} className="animate-spin" />}
                  {t("common.save")}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setFolderCreateOpen(true)}
              className="flex items-center gap-1.5 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
              style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
              <Plus size={14} /> {t("vault.newFolder")}
            </button>
          )}
        </div>
      )}

      {/* Folder grid */}
      {foldersError ? (
        <div className="mb-6 text-[13px] font-semibold" style={{ ...glass(), padding: 20, color: "#F07A6B" }}>
          {foldersError}
        </div>
      ) : foldersLoading ? (
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 148, borderRadius: 20, background: panel, border: `1px solid ${panelBorder}` }} />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <p className="text-[12.5px] font-semibold mb-6" style={{ color: txt3 }}>
          {t("vault.emptySubfolder")}
        </p>
      ) : (
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {folders.map(f => (
            <FolderCard key={f.id} folder={{
              name: f.name,
              count: f.documentCount,
              meta: f.hasChildren
                ? t("vault.folderMetaWithChildren", { count: f.documentCount })
                : t("vault.folderMetaPlain", { count: f.documentCount }),
              accent: false,
              locked: false,
            }} onClick={() => setFolderStack(s => [...s, { id: f.id, name: f.name }])} />
          ))}
        </div>
      )}

      {/* Document table — faqat haqiqiy papka ichida (root darajada folderId yo'q) */}
      {currentFolder.id && (
        <div style={{ ...glass() }}>
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-['Sora'] text-[15px] font-semibold" style={{ color: txt }}>{t("vault.tableTitle")}</h2>
            <span className="text-[11.5px] font-bold" style={{ color: txt3 }}>{t("vault.sortLabel")} ↓</span>
          </div>
          {documentsError ? (
            <p className="px-5 pb-5 text-[13px] font-semibold" style={{ color: "#F07A6B" }}>{documentsError}</p>
          ) : documentsLoading ? (
            <div className="px-5 pb-5 space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} style={{ height: 44, borderRadius: 12, background: panel }} />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <p className="px-5 pb-5 text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("vault.emptyDocuments")}</p>
          ) : vaultSeg === "table" ? (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, padding: "11px 12px 11px 22px", borderBottom: `1px solid ${panelBorder}`, textAlign: "left" }}>
                      <span onClick={toggleAll} className="w-4 h-4 rounded-[5px] inline-grid place-items-center cursor-pointer"
                        style={{ border: `1.5px solid ${txt3}`, background: selected.size === documents.length ? lime : "transparent" }}>
                        {selected.size === documents.length && <Check size={10} color="#0A1600" />}
                      </span>
                    </th>
                    {[t("vault.colDocument"), t("vault.colFiles"), t("vault.colType"), t("vault.colTags"), t("vault.colStatus"), t("vault.colVersion"), t("vault.colApproved"), t("vault.colDept")].map(h => (
                      <th key={h} style={{ padding: "11px 18px", borderBottom: `1px solid ${panelBorder}`, textAlign: "left", fontSize: 10.5, fontWeight: 800, letterSpacing: ".7px", textTransform: "uppercase", color: txt3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id} onClick={() => openDocument(doc.id)} className="cursor-pointer" style={{ transition: ".15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "13px 12px 13px 22px" }} onClick={e => { e.stopPropagation(); toggleDoc(doc.id); }}>
                        <span className="w-4 h-4 rounded-[5px] inline-grid place-items-center cursor-pointer"
                          style={{ border: `1.5px solid ${selected.has(doc.id) ? lime : txt3}`, background: selected.has(doc.id) ? lime : "transparent" }}>
                          {selected.has(doc.id) && <Check size={10} color="#0A1600" />}
                        </span>
                      </td>
                      <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}`, color: txt, fontWeight: 700 }}>
                        {doc.title}
                        <span className="block text-[11px] font-semibold mt-0.5" style={{ color: txt3 }}>
                          {doc.docNumber ? `№ ${doc.docNumber}` : ""}{doc.authorName ? ` · ${doc.authorName}` : ""}
                        </span>
                      </td>
                      {/* Fayl-chip'lar: hover'da ko'rish/yuklab olish/tahrirlash/o'chirish (foydalanuvchi so'rovi) */}
                      <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}` }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {([["pdf", doc.pdfFile], ["docx", doc.docxFile]] as const).map(([kind, fileRef]) =>
                            fileRef ? (
                              <FileChip key={kind} kind={kind} originalName={fileRef.originalName}
                                canEdit={canEditDocuments} isDark={isDark} panelBorder={panelBorder} txt2={txt2}
                                onView={() => handleFileOpen(fileRef.id, "inline")}
                                onDownload={() => handleFileOpen(fileRef.id, "attachment")}
                                onEdit={() => handleDocEditFromTable(doc.id)}
                                onDelete={() => handleDocDeleteFromTable(doc)} />
                            ) : null,
                          )}
                          {!doc.pdfFile && !doc.docxFile && <span style={{ color: txt3, fontWeight: 600 }}>—</span>}
                        </div>
                      </td>
                      <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}`, color: txt2, fontWeight: 600 }}>{doc.docTypeName}</td>
                      <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}` }}>
                        {doc.tags.map(tag => <TagBadge key={tag} label={tag} />)}
                      </td>
                      <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}` }}>
                        <StatusBadge status={docStatusToBadgeKey(doc.status)} />
                      </td>
                      <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}` }}>
                        <span className="text-[11px] font-extrabold px-2 py-1 rounded-[7px]"
                          style={{ border: `1px solid ${panelBorder}`, color: txt3 }}>{doc.currentVersionLabel ?? "—"}</span>
                      </td>
                      <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}`, color: txt2, fontWeight: 600 }}>{formatDate(doc.approvedAt)}</td>
                      <td style={{ padding: "13px 18px", borderBottom: `1px solid ${panelBorder}`, color: txt2, fontWeight: 600 }}>{doc.orgUnitName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : vaultSeg === "card" ? (
            /* ── Kartochka ko'rinishi ── */
            <div className="grid gap-4 px-5 pb-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {documents.map(doc => (
                <div key={doc.id} onClick={() => openDocument(doc.id)}
                  className="cursor-pointer transition-all duration-200 hover:-translate-y-1"
                  style={{
                    borderRadius: 16, padding: "16px 16px 14px",
                    background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)",
                    border: `1px solid ${panelBorder}`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${lime}55`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = panelBorder)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex gap-1.5">
                      {doc.pdfFile && <FileTypeIcon kind="pdf" size={30} />}
                      {doc.docxFile && <FileTypeIcon kind="docx" size={30} />}
                      {!doc.pdfFile && !doc.docxFile && (
                        <span className="text-[11px] font-bold" style={{ color: txt3 }}>—</span>
                      )}
                    </div>
                    <StatusBadge status={docStatusToBadgeKey(doc.status)} />
                  </div>
                  <p className="font-['Sora'] text-[13.5px] font-semibold leading-snug mb-1"
                    style={{ color: txt, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {doc.title}
                  </p>
                  <p className="text-[11px] font-semibold mb-2" style={{ color: txt3 }}>
                    {doc.docNumber ? `№ ${doc.docNumber} · ` : ""}{doc.authorName}
                  </p>
                  <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: txt2 }}>
                    <span>{doc.docTypeName}</span>
                    <span style={{ color: txt3 }}>{formatDate(doc.approvedAt)}</span>
                  </div>
                  {doc.tags.length > 0 && (
                    <div className="mt-2">{doc.tags.slice(0, 3).map(tag => <TagBadge key={tag} label={tag} />)}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── Timeline ko'rinishi — oy bo'yicha guruhlangan (tasdiqlangan, bo'lmasa yuklangan sana) ── */
            <div className="px-6 pb-6">
              {(() => {
                const dated = documents.map(doc => ({ doc, when: doc.approvedAt ?? doc.createdAt }))
                  .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
                const groups: { label: string; items: typeof dated }[] = [];
                const monthFmt = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" });
                for (const entry of dated) {
                  const label = monthFmt.format(new Date(entry.when));
                  const last = groups[groups.length - 1];
                  if (last && last.label === label) last.items.push(entry);
                  else groups.push({ label, items: [entry] });
                }
                return groups.map((group, gi) => (
                  <div key={group.label} className="mb-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-[.7px] mb-3 mt-2" style={{ color: lime }}>
                      {group.label}
                    </p>
                    {group.items.map(({ doc, when }, i) => {
                      const isLastOverall = gi === groups.length - 1 && i === group.items.length - 1;
                      return (
                        <div key={doc.id} className="flex gap-3.5 relative" style={{ paddingBottom: isLastOverall ? 4 : 20 }}>
                          {!isLastOverall && (
                            <div className="absolute left-[7px] top-[18px] bottom-0 w-[1.5px]" style={{ background: panelBorder }} />
                          )}
                          <div className="w-[15px] h-[15px] rounded-full border-2 flex-shrink-0 mt-1"
                            style={{
                              borderColor: doc.status === "ACTIVE" ? lime : txt3,
                              background: doc.status === "ACTIVE" ? lime : "transparent",
                              boxShadow: doc.status === "ACTIVE" ? `0 0 0 4px ${lime}22` : "none",
                            }} />
                          <div onClick={() => openDocument(doc.id)}
                            className="flex-1 cursor-pointer rounded-[13px] transition-colors px-3.5 py-2.5 -mt-1"
                            style={{ border: `1px solid transparent` }}
                            onMouseEnter={e => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)"; e.currentTarget.style.borderColor = panelBorder; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-[11px] font-extrabold whitespace-nowrap" style={{ color: txt3 }}>{formatDate(when)}</span>
                              <span className="text-[13px] font-bold" style={{ color: txt }}>{doc.title}</span>
                              {doc.docNumber && <span className="text-[11px] font-semibold" style={{ color: txt3 }}>№ {doc.docNumber}</span>}
                              <StatusBadge status={docStatusToBadgeKey(doc.status)} />
                            </div>
                            <p className="text-[11px] font-semibold mt-1" style={{ color: txt2 }}>
                              {doc.docTypeName}{doc.authorName ? ` · ${doc.authorName}` : ""}
                              {!doc.approvedAt && <span style={{ color: txt3 }}> · {t("vault.timelineUploadedAt")}</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── DOCUMENT DETAIL (real backend — TZ-1 §1.3) ────────────────────────────
  const DocDetail = (
    <div>
      {docDetailLoading ? (
        <div style={{ ...glass(), padding: 40, textAlign: "center" }}>
          <Loader2 size={24} className="animate-spin mx-auto" style={{ color: txt3 }} />
        </div>
      ) : docDetailError ? (
        <div style={{ ...glass(), padding: 20, color: "#F07A6B" }}>{docDetailError}</div>
      ) : !docDetail ? null : (
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
                {docDetail.title}
              </h1>
              <div className="flex flex-wrap gap-3 items-center text-[12px] font-semibold" style={{ color: txt2 }}>
                {docDetail.docNumber && <span>№ {docDetail.docNumber}</span>}
                <span>{formatDate(docDetail.approvedAt)}</span>
                <span>{docDetail.authorName}</span>
                {docDetail.orgUnitName && <span>{docDetail.orgUnitName}</span>}
                {canEditDocuments ? (
                  <select value={docDetail.status} onChange={e => handleStatusChange(e.target.value)}
                    className="text-[11px] font-bold rounded-full px-2.5 py-[5px] cursor-pointer"
                    style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
                    {["DRAFT", "IN_REVIEW", "ACTIVE", "EXPIRED"].map(s => (
                      <option key={s} value={s}>{t(`status.${docStatusToBadgeKey(s)}`)}</option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge status={docStatusToBadgeKey(docDetail.status)} />
                )}
                {docDetail.tags.map(tag => <TagBadge key={tag} label={tag} />)}
              </div>

              {statusChangeOpen && (
                <div className="mt-3 space-y-2 rounded-xl p-3.5" style={{ background: panel, border: `1px solid ${panelBorder}` }}>
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1" style={{ color: txt3 }}>{t("common.expireDateLabel")}</label>
                    <input type="date" value={statusChangeDate} onChange={e => setStatusChangeDate(e.target.value)}
                      className="w-full outline-none rounded-lg text-[13px] font-semibold px-3 py-2"
                      style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1" style={{ color: txt3 }}>{t("common.expireReasonLabel")}</label>
                    <textarea value={statusChangeNote} onChange={e => setStatusChangeNote(e.target.value)} rows={2}
                      className="w-full outline-none rounded-lg text-[13px] font-semibold px-3 py-2"
                      style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setStatusChangeOpen(false)}
                      className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>
                      {t("common.cancel")}
                    </button>
                    <button onClick={confirmExpire} disabled={!statusChangeDate || !statusChangeNote || statusChangeSaving}
                      className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                      style={{ background: lime, color: "#0A1600", border: "none" }}>
                      {t("common.confirm")}
                    </button>
                  </div>
                </div>
              )}

              {docEditOpen && (
                <div className="mt-3 space-y-2 rounded-xl p-3.5" style={{ background: panel, border: `1px solid ${panelBorder}` }}>
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1" style={{ color: txt3 }}>{t("wizard.fieldDocName")}</label>
                    <input value={docEditForm.title} onChange={e => setDocEditForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full outline-none rounded-lg text-[13px] font-semibold px-3 py-2"
                      style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1" style={{ color: txt3 }}>{t("wizard.fieldNumber")}</label>
                      <input value={docEditForm.docNumber} onChange={e => setDocEditForm(f => ({ ...f, docNumber: e.target.value }))}
                        className="w-full outline-none rounded-lg text-[13px] font-semibold px-3 py-2"
                        style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1" style={{ color: txt3 }}>{t("wizard.fieldType")}</label>
                      <select value={docEditForm.docTypeId} onChange={e => setDocEditForm(f => ({ ...f, docTypeId: e.target.value }))}
                        className="w-full outline-none rounded-lg text-[13px] font-semibold px-3 py-2 cursor-pointer"
                        style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }}>
                        {documentTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1" style={{ color: txt3 }}>{t("wizard.fieldApprovedDate")}</label>
                    <input type="date" value={docEditForm.approvedAt} onChange={e => setDocEditForm(f => ({ ...f, approvedAt: e.target.value }))}
                      className="w-full outline-none rounded-lg text-[13px] font-semibold px-3 py-2"
                      style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1" style={{ color: txt3 }}>{t("wizard.fieldTags")}</label>
                    <input value={docEditForm.tagsRaw} onChange={e => setDocEditForm(f => ({ ...f, tagsRaw: e.target.value }))}
                      placeholder={t("wizard.fieldTagsPlaceholder")}
                      className="w-full outline-none rounded-lg text-[13px] font-semibold px-3 py-2"
                      style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setDocEditOpen(false)}
                      className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>
                      {t("common.cancel")}
                    </button>
                    <button onClick={handleSaveDocEdit} disabled={!docEditForm.title.trim() || docEditSaving}
                      className="flex items-center gap-2 text-[11.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                      style={{ background: lime, color: "#0A1600", border: "none" }}>
                      {docEditSaving && <Loader2 size={12} className="animate-spin" />}
                      {t("common.save")}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => currentVersion && handleFileOpen(currentVersion.pdf.id, "attachment")}
                className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
                style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
                <Download size={14} /> {t("docDetail.download")}
              </button>
              {canEditDocuments && (
                <button onClick={openDocEdit}
                  className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
                  style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
                  <Pencil size={14} /> {t("docDetail.edit")}
                </button>
              )}
              {canEditDocuments && (
                <button onClick={openVersionModal}
                  className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
                  style={{ background: lime, color: "#0A1600", border: "none", boxShadow: `0 6px 18px ${lime}44` }}>
                  <Plus size={14} /> {t("docDetail.newVersion")}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 overflow-x-auto" style={{ borderBottom: `1px solid ${panelBorder}` }}>
            {(["pdf", "word", "diff", "history"] as DocTab[]).map(dt => {
              const labels: Record<DocTab, string> = {
                pdf: "PDF",
                word: "Word",
                diff: t("docDetail.tabDiff"),
                history: t("docDetail.tabHistory"),
              };
              return (
                <div key={dt} onClick={() => setDocTab(dt)}
                  className="px-4 py-3 text-[13px] font-bold cursor-pointer whitespace-nowrap"
                  style={{
                    color: docTab === dt ? lime : txt3,
                    borderBottom: `2px solid ${docTab === dt ? lime : "transparent"}`,
                  }}>
                  {labels[dt]}
                </div>
              );
            })}
          </div>

          {/* PDF preview — brauzer native PDF renderi orqali */}
          {docTab === "pdf" && currentVersion && (
            <div className="mx-6 my-5 rounded-xl overflow-hidden" style={{ height: 600, border: `1px solid ${panelBorder}` }}>
              <iframe src={currentVersion.pdf.downloadUrl} title="PDF" style={{ width: "100%", height: "100%", border: "none" }} />
            </div>
          )}

          {/* Word preview — mammoth orqali client-side HTML */}
          {docTab === "word" && (
            !currentVersion?.docx ? (
              <p className="mx-6 my-5 text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("common.wordMissing")}</p>
            ) : wordLoading ? (
              <div className="mx-6 my-5" style={{ height: 200, borderRadius: 12, background: panel }} />
            ) : (
              <div className="mx-6 my-5 rounded-xl p-6 text-[13px]"
                style={{ background: "#F4F7F5", color: "#1a1a1a", maxHeight: 600, overflowY: "auto" }}
                dangerouslySetInnerHTML={{ __html: wordHtml ?? "" }} />
            )
          )}

          {/* Diff — versiyalash (TZ-1 §1.4) keyingi bosqichda */}
          {docTab === "diff" && (
            <p className="mx-6 my-5 text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("common.noComparisonYet")}</p>
          )}

          {/* History — bitta versiyadan ortig'i bo'lganda keyingi bosqichda kengaytiriladi */}
          {docTab === "history" && (
            <p className="mx-6 my-5 text-[12.5px] font-semibold" style={{ color: txt3 }}>
              {t("docDetail.versions")}: {docDetail.versions.length}
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Versions — real ma'lumot */}
          <div style={{ ...glass(), padding: 20 }}>
            <h3 className="font-['Sora'] text-[13px] font-semibold mb-3.5" style={{ color: txt }}>
              {t("docDetail.versions")}
            </h3>
            {docDetail.versions.map((v, i, arr) => (
              <div key={v.id} className="flex gap-3 relative" style={{ paddingBottom: i < arr.length - 1 ? 18 : 0 }}>
                {i < arr.length - 1 && <div className="absolute left-[7px] top-[18px] bottom-0 w-[1.5px]" style={{ background: panelBorder }} />}
                <div className="w-[15px] h-[15px] rounded-full border-2 flex-shrink-0 mt-0.5"
                  style={{
                    borderColor: v.isCurrent ? lime : txt3,
                    background: v.isCurrent ? lime : bg,
                    boxShadow: v.isCurrent ? `0 0 0 4px ${lime}22` : "none",
                  }} />
                <div>
                  <p className="text-[13px] font-bold" style={{ color: txt }}>
                    {v.versionLabel}{v.isCurrent ? ` — ${t("common.current")}` : ""}
                  </p>
                  <p className="text-[11px] font-semibold mt-0.5 leading-relaxed" style={{ color: txt3 }}>
                    {formatDate(v.createdAt)} · {v.createdByName}
                  </p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <span onClick={() => handleFileOpen(v.pdf.id, "attachment")}
                      className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-[6px] cursor-pointer"
                      style={{ border: `1px solid ${panelBorder}`, color: txt2 }}>PDF</span>
                    {v.docx && (
                      <span onClick={() => handleFileOpen(v.docx!.id, "attachment")}
                        className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-[6px] cursor-pointer"
                        style={{ border: `1px solid ${panelBorder}`, color: txt2 }}>DOCX</span>
                    )}
                    {v.diff && (
                      <span onClick={() => handleFileOpen(v.diff!.id, "attachment")}
                        className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-[6px] cursor-pointer"
                        style={{ border: `1px solid ${lime}55`, color: lime }}>{t("docDetail.diffChip")}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Relations — real backend (TZ-2) */}
          <div style={{ ...glass(), padding: 20 }}>
            <h3 className="font-['Sora'] text-[13px] font-semibold flex justify-between items-center mb-3.5" style={{ color: txt }}>
              {t("docDetail.relations")}
              {canEditDocuments && (
                <span onClick={() => setRelationAddOpen(o => !o)} className="text-[11px] font-extrabold cursor-pointer" style={{ color: lime, fontFamily: "Manrope" }}>{t("docDetail.addRelation")}</span>
              )}
            </h3>

            {relationAddOpen && (
              <div className="mb-4 rounded-xl p-3" style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}` }}>
                {!relationTargetId ? (
                  <>
                    <input autoFocus value={relationSearch} onChange={(e) => setRelationSearch(e.target.value)}
                      placeholder={t("docDetail.searchDocument")}
                      className="w-full outline-none rounded-lg text-[12.5px] font-semibold px-3 py-2 mb-1.5"
                      style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
                    {relationSearchResults.map((d) => (
                      <div key={d.id} onClick={() => { setRelationTargetId(d.id); setRelationTargetTitle(d.title); }}
                        className="text-[12px] font-semibold px-2 py-1.5 rounded-lg cursor-pointer" style={{ color: txt2 }}>
                        {d.title}{d.docNumber ? ` № ${d.docNumber}` : ""}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12.5px] font-bold" style={{ color: txt }}>{relationTargetTitle}</span>
                      <span onClick={() => { setRelationTargetId(null); setRelationTargetTitle(""); }} className="cursor-pointer" style={{ color: txt3 }}>
                        <X size={13} />
                      </span>
                    </div>
                    <select value={relationType} onChange={(e) => setRelationType(e.target.value as RelationType)}
                      className="w-full outline-none rounded-lg text-[12.5px] font-semibold px-3 py-2 mb-1.5 cursor-pointer"
                      style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }}>
                      {RELATION_TYPES.map((rt) => <option key={rt} value={rt}>{t(`relationType.${rt}`)}</option>)}
                    </select>
                    <input value={relationNote} onChange={(e) => setRelationNote(e.target.value)}
                      placeholder={t("docDetail.relationNotePlaceholder")}
                      className="w-full outline-none rounded-lg text-[12.5px] font-semibold px-3 py-2 mb-2"
                      style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setRelationAddOpen(false)}
                        className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                        style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>
                        {t("common.cancel")}
                      </button>
                      <button onClick={handleAddRelation} disabled={relationSaving}
                        className="flex items-center gap-2 text-[11.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                        style={{ background: lime, color: "#0A1600", border: "none" }}>
                        {relationSaving && <Loader2 size={12} className="animate-spin" />}
                        {t("common.save")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {relations.length === 0 ? (
              <p className="text-[12px] font-semibold" style={{ color: txt3 }}>{t("docDetail.noRelations")}</p>
            ) : (
              relations.map((rel) => (
                <div key={rel.id} className="flex items-center gap-2.5 py-2 text-[12.5px] font-semibold" style={{ color: txt2 }}>
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-[6px] flex-shrink-0 whitespace-nowrap"
                    style={{ background: RELATION_TYPE_STYLE[rel.type].bg, color: RELATION_TYPE_STYLE[rel.type].color }}>
                    {rel.direction === "INCOMING" ? "← " : ""}{t(`relationType.${rel.type}`)}
                  </span>
                  <span onClick={() => openDocument(rel.document.id)} className="flex-1 cursor-pointer truncate">{rel.document.title}</span>
                  {canEditDocuments && (
                    <span onClick={() => handleRemoveRelation(rel.id)} className="cursor-pointer flex-shrink-0" style={{ color: txt3 }}>
                      <X size={13} />
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Audit — real (TZ-2 §2.7, avval mock edi) */}
          <div style={{ ...glass(), padding: 20 }}>
            <h3 className="font-['Sora'] text-[13px] font-semibold mb-3.5" style={{ color: txt }}>{t("docDetail.audit")}</h3>
            {docAuditLog.length === 0 ? (
              <p className="text-[11.5px] font-semibold" style={{ color: txt3 }}>{t("dashboard.noActivity")}</p>
            ) : docAuditLog.map((a, i, arr) => (
              <div key={a.id} className="flex justify-between gap-2.5 py-1.5 text-[11.5px] font-semibold"
                style={{ borderBottom: i < arr.length - 1 ? `1px dashed ${panelBorder}` : "none", color: txt2 }}>
                <span>{a.userName ?? "—"} · {activityActionLabel(a.action)}</span>
                <span className="flex-shrink-0" style={{ color: txt3 }}>{formatDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );

  // ── YANGI VERSIYA MODALI (TZ-1 §1.4) ─────────────────────────
  const verCurrentLabel = docDetail?.currentVersionLabel ?? null;
  const VersionModal = verOpen && docDetail && (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-auto"
      style={{ background: isDark ? "rgba(0,6,14,.55)" : "rgba(20,40,32,.3)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && closeVersionModal()}>
      <div className="my-[7vh] overflow-hidden"
        style={{ width: "min(560px, 94vw)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, borderRadius: 20, boxShadow: "0 32px 80px rgba(0,0,0,.55)", padding: 26 }}>
        <h2 className="font-['Sora'] text-[17px] font-semibold mb-1" style={{ color: txt }}>{t("version.title")}</h2>
        <p className="text-[12px] font-semibold mb-4" style={{ color: txt2 }}>
          {docDetail.title}{verCurrentLabel ? ` · ${verCurrentLabel} → ${nextVersionLabel(verCurrentLabel, verType)}` : ` · ${t("version.firstVersion")}`}
        </p>

        {/* Versiya turi */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {([["MINOR", t("version.typeMinor")], ["MAJOR", t("version.typeMajor")]] as const).map(([value, label]) => (
            <div key={value} onClick={() => setVerType(value)}
              className="cursor-pointer rounded-[13px] px-3.5 py-3 transition-colors"
              style={{
                border: `1.5px solid ${verType === value ? lime : panelBorder}`,
                background: verType === value ? `${lime}12` : "transparent",
              }}>
              <p className="text-[12.5px] font-bold" style={{ color: verType === value ? lime : txt }}>{label}</p>
              <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: txt3 }}>
                {verCurrentLabel ?? "v1.0"} → {nextVersionLabel(verCurrentLabel, value)}
              </p>
            </div>
          ))}
        </div>

        {/* Taqqoslama shablon (faqat mavjud versiya bo'lsa) */}
        {docDetail.versions.length > 0 && (
          <div className="rounded-[13px] mb-4 px-3.5 py-3" style={{ border: `1px solid ${panelBorder}`, background: isDark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>
            <p className="text-[11px] font-extrabold uppercase tracking-wide mb-2" style={{ color: txt3 }}>{t("version.templateSection")}</p>
            {tplState === "idle" && (
              <button onClick={startTemplateGeneration}
                className="text-[12px] font-bold px-3.5 py-2 rounded-[11px] cursor-pointer"
                style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
                {t("version.templateGenerate")}
              </button>
            )}
            {tplState === "running" && (
              <p className="flex items-center gap-2 text-[12px] font-bold" style={{ color: txt2 }}>
                <Loader2 size={14} className="animate-spin" /> {t("version.templateRunning")}
              </p>
            )}
            {tplState === "done" && tplFileId && (
              <div>
                <button onClick={() => handleFileOpen(tplFileId, "attachment")}
                  className="flex items-center gap-2 text-[12px] font-bold px-3.5 py-2 rounded-[11px] cursor-pointer"
                  style={{ background: `${lime}18`, border: `1px solid ${lime}44`, color: isDark ? lime : "#2FA45B" }}>
                  <Download size={13} /> {t("version.templateDownload")}
                </button>
                {tplFallback && (
                  <p className="text-[10.5px] font-semibold mt-2" style={{ color: "#F0C24B" }}>{t("version.templateFallback")}</p>
                )}
              </div>
            )}
            {tplState === "failed" && (
              <p className="text-[12px] font-bold" style={{ color: "#F07A6B" }}>
                {t("version.templateFailed")}{" "}
                <span onClick={startTemplateGeneration} className="cursor-pointer underline" style={{ color: txt2 }}>↻</span>
              </p>
            )}
          </div>
        )}

        {/* Fayllar */}
        <input ref={verPdfInputRef} type="file" accept="application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleVersionFile("pdf", f); e.target.value = ""; }} />
        <input ref={verDocxInputRef} type="file" accept=".docx" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleVersionFile("docx", f); e.target.value = ""; }} />
        <input ref={verDiffInputRef} type="file" accept=".docx" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleVersionFile("diff", f); e.target.value = ""; }} />
        <div className="space-y-2 mb-4">
          {([
            ["pdf", t("version.newPdf"), verPdf, verPdfInputRef, () => setVerPdf(null)],
            ["docx", t("version.newDocx"), verDocx, verDocxInputRef, () => setVerDocx(null)],
            ["diff", t("version.filledDiff"), verDiff, verDiffInputRef, () => setVerDiff(null)],
          ] as const).map(([kind, label, picked, ref, clear]) => (
            <div key={kind}>
              {picked ? (
                <div className="flex items-center gap-2.5 text-[12px] font-bold rounded-xl px-3.5 py-2.5"
                  style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", border: `1px solid ${panelBorder}` }}>
                  <FileText size={14} style={{ color: txt3 }} />
                  <span className="truncate" style={{ color: txt }}>{picked.originalName}</span>
                  <span onClick={clear} className="ml-auto cursor-pointer text-[13px]" style={{ color: txt3 }}>✕</span>
                </div>
              ) : (
                <div onClick={() => verUploading === null && ref.current?.click()}
                  className="rounded-xl text-[12px] font-bold px-3.5 py-2.5 cursor-pointer transition-colors flex items-center gap-2"
                  style={{ border: `1.5px dashed ${panelBorder}`, color: txt3 }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${lime}66`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = panelBorder)}>
                  {verUploading === kind ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {label}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Izoh */}
        <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{t("version.noteLabel")}</label>
        <input value={verNote} onChange={e => setVerNote(e.target.value)}
          className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3 mb-5"
          style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />

        <div className="flex justify-end gap-2">
          <button onClick={closeVersionModal}
            className="text-[12.5px] font-bold px-4 py-2.5 rounded-[13px] cursor-pointer"
            style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
            {t("version.cancel")}
          </button>
          <button onClick={saveNewVersion} disabled={!verPdf || verSaving || verUploading !== null}
            className="text-[12.5px] font-bold px-5 py-2.5 rounded-[13px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: lime, color: "#0A1600", border: "none", boxShadow: `0 6px 18px ${lime}44` }}>
            {verSaving ? t("version.saving") : t("version.save")}
          </button>
        </div>
      </div>
    </div>
  );

  // ── MONITORING ────────────────────────────────────────────────────────────
  const Monitoring = (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: txt }}>{t("monitoring.title")}</h1>
          <p className="text-sm mt-1" style={{ color: txt2 }}>cbu.uz va lex.uz · har 2 soatda tekshiriladi · oxirgi skan: 14:00</p>
        </div>
        <button className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
          style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
          <Settings size={14} /> {t("monitoring.sourceSettings")}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {[
          { key: "all", label: t("monitoring.filterAll") },
          { key: "cbu", label: "CBU" },
          { key: "lex", label: "Lex.uz" },
          { key: "new", label: t("monitoring.filterNew") },
          { key: "reviewed", label: t("monitoring.filterReviewed") },
        ].map(c => (
          <button key={c.key} onClick={() => setMonFilter(c.key)}
            className="text-[12px] font-bold px-3.5 py-1.5 rounded-full cursor-pointer transition-all"
            style={monFilter === c.key
              ? { background: `${lime}22`, border: `1px solid ${lime}55`, color: lime }
              : { background: panel, border: `1px solid ${panelBorder}`, color: txt2, backdropFilter: "blur(10px)" }}>
            {c.label}
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
                    <span className="text-[10.5px] font-bold px-3 py-1 rounded-full" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>{t("monitoring.relatedDocsLabel")}</span>
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
        {t("monitoring.disclaimer")}
      </p>
    </div>
  );

  // ── CMD+K ──────────────────────────────────────────────────────────────────
  const cmdkGroups = [
    { section: t("cmdk.sectionActions"), items: [
      { key: "yangi hujjat yuklash", icon: <Plus size={15} />, label: t("cmdk.actionUpload"), kbd: "N", action: "wiz" },
      { key: "yangi versiya shablon", icon: <FileText size={15} />, label: t("cmdk.actionNewVersion"), kbd: "V", action: "doc" },
      { key: "graf boglanish", icon: <Network size={15} />, label: t("cmdk.actionOpenGraph"), kbd: "G", action: "graph" },
    ]},
  ];

  const CmdK = cmdkOpen && (
    <div className="fixed inset-0 z-[90] flex items-start justify-center"
      style={{ background: isDark ? "rgba(0,6,14,.55)" : "rgba(20,40,32,.3)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && setCmdkOpen(false)}>
      <div className="mt-[12vh] overflow-hidden"
        style={{ width: "min(620px, 92vw)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, borderRadius: 18, backdropFilter: "blur(24px)", boxShadow: "0 32px 80px rgba(0,0,0,.55)" }}>
        <input autoFocus value={cmdkQuery} onChange={e => setCmdkQuery(e.target.value)}
          placeholder={t("cmdk.placeholder")}
          className="w-full bg-transparent outline-none"
          style={{ padding: "18px 20px", fontSize: 15, color: txt, fontFamily: "Manrope", fontWeight: 600, borderBottom: `1px solid ${panelBorder}` }} />
        <div className="max-h-[52vh] overflow-auto">
          {/* Amallar — faqat qidiruv bo'sh yoki kalitga mos bo'lganda */}
          {cmdkGroups.map(group => {
            const filtered = group.items.filter(it => it.key.includes(cmdkQuery.toLowerCase()) || cmdkQuery.trim() === "");
            if (!filtered.length) return null;
            return (
              <div key={group.section}>
                <p className="text-[10px] font-extrabold uppercase tracking-[.7px] px-5 pt-3 pb-1.5" style={{ color: txt3 }}>{group.section}</p>
                {filtered.map(item => (
                  <div key={item.key}
                    onClick={() => {
                      setCmdkOpen(false);
                      if (item.action === "wiz") { openWizard(); }
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
                  </div>
                ))}
              </div>
            );
          })}

          {/* Hujjatlar — real qidiruv natijalari (nom/raqam bo'yicha) */}
          {cmdkQuery.trim().length >= 2 && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.7px] px-5 pt-3 pb-1.5" style={{ color: txt3 }}>{t("cmdk.sectionDocuments")}</p>
              {cmdkSearching && cmdkResults.length === 0 ? (
                <p className="px-5 py-3 text-[12.5px] font-semibold flex items-center gap-2" style={{ color: txt3 }}>
                  <Loader2 size={13} className="animate-spin" /> {t("cmdk.searching")}
                </p>
              ) : cmdkResults.length === 0 ? (
                <p className="px-5 py-3 text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("cmdk.noResults")}</p>
              ) : (
                cmdkResults.map(doc => (
                  <div key={doc.id}
                    onClick={() => { setCmdkOpen(false); openDocument(doc.id); }}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-all text-[13.5px] font-bold"
                    style={{ color: txt2 }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${lime}14`)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ color: txt3 }}><FileText size={15} /></span>
                    <span style={{ flex: 1, color: txt }} className="truncate">{doc.title}</span>
                    <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: txt3 }}>
                      {doc.docNumber ? `${doc.docNumber} · ` : ""}{doc.docTypeName}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex gap-4 px-5 py-2.5 text-[10.5px] font-bold" style={{ borderTop: `1px solid ${panelBorder}`, color: txt3 }}>
          {[["↑↓", t("cmdk.hintSelect")], ["↵", t("cmdk.hintOpen")], ["esc", t("cmdk.hintClose")]].map(([k, v]) => (
            <span key={k}><span className="border rounded px-1.5 py-0.5 mr-1" style={{ borderColor: panelBorder }}>{k}</span>{v}</span>
          ))}
          <span className="ml-auto">{t("cmdk.semanticHint")}</span>
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
        <h2 className="font-['Sora'] text-[16px] font-semibold" style={{ color: txt }}>{t("drawer.title")}</h2>
        <button onClick={() => setDrawerOpen(false)} style={{ color: txt3, fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <p className="text-[11.5px] font-bold mb-4" style={{ color: txt3 }}>
        {t("drawer.unreadCount", { count: unreadCount })} ·{" "}
        <span className="cursor-pointer" style={{ color: lime }} onClick={handleMarkAllNotificationsRead}>{t("drawer.markAllRead")}</span>
      </p>
      {notifications.length === 0 ? (
        <p className="text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("drawer.empty")}</p>
      ) : notifications.map((n) => (
        <div key={n.id} className="rounded-[13px] mb-2.5 text-[12.5px]"
          style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}`, padding: "12px 14px", opacity: n.isRead ? 0.6 : 1 }}>
          <p className="flex items-center gap-2 font-bold mb-1" style={{ color: txt }}>
            <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: n.isRead ? txt3 : lime }} />
            {n.title}
          </p>
          <p className="font-semibold leading-relaxed" style={{ color: txt2 }}>{n.body}</p>
          <span onClick={() => {
            handleMarkNotificationRead(n.id);
            const docId = n.meta.documentId;
            if (typeof docId === "string") { setDrawerOpen(false); openDocument(docId); }
          }} className="inline-block mt-2 text-[11px] font-extrabold cursor-pointer" style={{ color: lime }}>
            {n.isRead ? t("drawer.viewed") : t("dashboard.viewNotification")}
          </span>
        </div>
      ))}
    </div>
  );

  // ── Wizard handlerlari (real upload + hujjat yaratish, TZ-1 §1.3) ─────────
  // ── UPLOAD WIZARD ─────────────────────────────────────────────────────────
  const Wizard = wizOpen && (
    <div className="fixed inset-0 z-[90] flex items-start justify-center"
      style={{ background: isDark ? "rgba(0,6,14,.55)" : "rgba(20,40,32,.3)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && setWizOpen(false)}>
      <div className="mt-[9vh] overflow-hidden"
        style={{ width: "min(560px, 94vw)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, borderRadius: 20, backdropFilter: "blur(26px)", boxShadow: "0 32px 80px rgba(0,0,0,.55)", padding: 26 }}>
        <h2 className="font-['Sora'] text-[17px] font-semibold mb-1" style={{ color: txt }}>{t("wizard.title")}</h2>
        <p className="text-[12px] font-semibold mb-4" style={{ color: txt2 }}>
          {[t("wizard.step1"), t("wizard.step2"), t("wizard.step3")][wizStep - 1]}
        </p>
        {/* Steps bar */}
        <div className="flex gap-1.5 mb-5">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 h-1 rounded-full" style={{ background: s <= wizStep ? lime : panelBorder }} />
          ))}
        </div>

        {wizError && (
          <p className="mb-3 text-[12px] font-semibold rounded-xl px-3.5 py-2.5"
            style={{ color: "#F07A6B", background: "rgba(240,122,107,.12)" }}>{wizError}</p>
        )}

        {wizStep === 1 && (
          <div>
            {([
              { kind: "pdf" as const, label: t("wizard.uploadPdfLabel"), hint: t("wizard.uploadPdfHint"), accept: ".pdf", upload: pdfUpload, uploading: pdfUploading },
              { kind: "docx" as const, label: t("wizard.uploadWordLabel"), hint: t("wizard.uploadWordHint"), accept: ".docx", upload: docxUpload, uploading: docxUploading },
            ]).map(f => f.upload ? (
              <div key={f.kind} className="flex items-center gap-3 text-[12.5px] font-bold mb-2.5 rounded-xl px-3.5 py-3"
                style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", border: `1px solid ${panelBorder}` }}>
                <FileText size={15} style={{ color: txt3 }} />
                <span style={{ color: txt }}>{f.upload.originalName}</span>
                <span className="font-semibold" style={{ color: txt3 }}>· {(f.upload.sizeBytes / 1024).toFixed(0)} KB</span>
                <span className="ml-auto text-[11px] font-extrabold" style={{ color: lime }}>{t("wizard.hashVerified")}</span>
              </div>
            ) : (
              <label key={f.kind}
                className="block rounded-2xl text-center cursor-pointer transition-all mb-3 hover:border-[#C6F24E]"
                style={{ border: `1.5px dashed ${panelBorder}`, padding: "28px 20px" }}>
                <input type="file" accept={f.accept} className="hidden" disabled={f.uploading}
                  onChange={e => { const file = e.target.files?.[0]; if (file) handlePickFile(f.kind, file); e.target.value = ""; }} />
                {f.uploading
                  ? <Loader2 size={28} className="mx-auto mb-2 animate-spin" style={{ color: txt3 }} />
                  : <Upload size={28} className="mx-auto mb-2" style={{ color: txt3 }} />}
                <p className="font-bold text-[13.5px] mb-1" style={{ color: txt }}>{f.label}</p>
                <p className="text-[11.5px] font-semibold" style={{ color: txt3 }}>
                  {f.uploading ? t("common.uploading") : f.hint}
                </p>
              </label>
            ))}
          </div>
        )}

        {wizStep === 2 && (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{t("wizard.fieldDocName")}</label>
              <input value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))}
                className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{t("wizard.fieldNumber")}</label>
                <input value={docForm.docNumber} onChange={e => setDocForm(f => ({ ...f, docNumber: e.target.value }))}
                  className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                  style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{t("wizard.fieldType")}</label>
                <select value={docForm.docTypeId} onChange={e => setDocForm(f => ({ ...f, docTypeId: e.target.value }))}
                  className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                  style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }}>
                  {documentTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{t("wizard.fieldApprovedDate")}</label>
              <input type="date" value={docForm.approvedAt} onChange={e => setDocForm(f => ({ ...f, approvedAt: e.target.value }))}
                className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>{t("wizard.fieldTags")}</label>
              <input value={docForm.tagsRaw} onChange={e => setDocForm(f => ({ ...f, tagsRaw: e.target.value }))}
                placeholder={t("wizard.fieldTagsPlaceholder")} className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3"
                style={{ background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, fontFamily: "Manrope" }} />
            </div>
          </div>
        )}

        {wizStep === 3 && (
          <div>
            <div className="rounded-[13px] text-[12.5px]"
              style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}`, padding: "12px 14px" }}>
              <p className="flex items-center gap-2 font-bold mb-1" style={{ color: txt }}>
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: lime }} />
                {t("wizard.ready")}
              </p>
              <p className="font-semibold leading-relaxed" style={{ color: txt2 }}>
                {docForm.title || "—"}
                {docForm.docNumber ? ` · № ${docForm.docNumber}` : ""}
                {` · ${docxUpload ? 2 : 1} fayl`}
                {`. Saqlangach hujjat DRAFT holatida yaratiladi.`}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-5">
          <button onClick={() => setWizStep(s => Math.max(1, s - 1) as 1 | 2 | 3)}
            className="text-[12.5px] font-bold px-4 py-2.5 rounded-[13px] cursor-pointer"
            style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2, visibility: wizStep > 1 ? "visible" : "hidden" }}>
            {t("wizard.back")}
          </button>
          <button
            disabled={(wizStep === 1 && !pdfUpload) || (wizStep === 2 && !docForm.title) || wizSaving}
            onClick={() => {
              if (wizStep < 3) setWizStep(s => (s + 1) as 1 | 2 | 3);
              else handleWizardSave();
            }}
            className="flex items-center gap-2 text-[12.5px] font-bold px-5 py-2.5 rounded-[13px] cursor-pointer disabled:opacity-50"
            style={{ background: lime, color: "#0A1600", border: "none", boxShadow: `0 6px 18px ${lime}44` }}>
            {wizSaving && <Loader2 size={14} className="animate-spin" />}
            {wizStep < 3 ? t("wizard.next") : t("wizard.save")}
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
      <strong style={{ color: lime, marginRight: 6 }}>{selected.size}</strong> {t("bulkBar.selectedSuffix")}

      {/* Teg qo'shish popover'i */}
      {bulkTagOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-xl px-2 py-1.5"
          style={{ bottom: "calc(100% + 8px)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, boxShadow: "0 12px 40px rgba(0,0,0,.4)" }}>
          <input autoFocus value={bulkTagValue} onChange={e => setBulkTagValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleBulkTagSubmit(); if (e.key === "Escape") setBulkTagOpen(false); }}
            placeholder={t("bulkBar.tagPlaceholder")}
            className="outline-none rounded-lg text-[12px] font-semibold px-2.5 py-1.5"
            style={{ background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${panelBorder}`, color: txt, width: 160, fontFamily: "Manrope" }} />
          <button onClick={handleBulkTagSubmit} className="text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
            style={{ background: lime, color: "#0A1600" }}>OK</button>
        </div>
      )}

      {/* Papkaga ko'chirish popover'i (yassi papka daraxti) */}
      {bulkMoveOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 rounded-xl py-1.5 overflow-auto"
          style={{ bottom: "calc(100% + 8px)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, boxShadow: "0 12px 40px rgba(0,0,0,.4)", minWidth: 220, maxHeight: 260 }}>
          <p className="text-[10px] font-extrabold uppercase tracking-wide px-3 py-1.5" style={{ color: txt3 }}>{t("bulkBar.moveTo")}</p>
          {bulkMoveFolders.length === 0 ? (
            <p className="px-3 py-2 text-[12px] font-semibold flex items-center gap-2" style={{ color: txt3 }}><Loader2 size={12} className="animate-spin" /> …</p>
          ) : bulkMoveFolders.map(f => (
            <div key={f.id} onClick={() => handleBulkMoveTo(f.id)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer text-[12.5px] font-semibold"
              style={{ color: txt2, paddingLeft: 12 + f.depth * 14 }}
              onMouseEnter={e => (e.currentTarget.style.background = `${lime}14`)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <FolderOpen size={13} style={{ color: txt3 }} /> {f.name}
            </div>
          ))}
        </div>
      )}

      {[
        { label: t("bulkBar.download"), icon: <Download size={13} />, action: () => void handleBulkDownload() },
        { label: t("bulkBar.tag"), icon: <Tag size={13} />, action: () => { setBulkMoveOpen(false); setBulkTagOpen(o => !o); } },
        { label: t("bulkBar.move"), icon: <Move size={13} />, action: () => { setBulkTagOpen(false); if (!bulkMoveOpen) void openBulkMove(); else setBulkMoveOpen(false); } },
        { label: t("bulkBar.delete"), icon: <Trash2 size={13} />, action: handleBulkDelete, red: true },
      ].map(btn => (
        <button key={btn.label} onClick={btn.action} disabled={bulkBusy}
          className="flex items-center gap-1.5 text-[11.5px] font-bold px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50"
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
        { v: "dash" as View, label: t("viewbar.dashboard") },
        { v: "vault" as View, label: t("viewbar.vault") },
        { v: "doc" as View, label: t("viewbar.doc") },
        { v: "graph" as View, label: t("viewbar.graph") },
        { v: "mon" as View, label: t("viewbar.mon") },
        { v: "cal" as View, label: t("viewbar.cal") },
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
  if (isBootstrapping) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "grid", placeItems: "center" }}>
        <Loader2 size={28} color="#C6F24E" className="animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div style={{ background: bg, minHeight: "100vh", position: "relative" }}>
      {/* Background ambient glows */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", right: "5%", width: 900, height: 500, borderRadius: "50%", background: `radial-gradient(ellipse, ${lime}18 0%, transparent 65%)`, filter: "blur(1px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 700, height: 500, borderRadius: "50%", background: `radial-gradient(ellipse, ${lime}0C 0%, transparent 60%)`, filter: "blur(1px)" }} />
      </div>

      <div className="flex" style={{ position: "relative", zIndex: 1 }}>
        {Sidebar}

        <main style={{ flex: 1, padding: "24px 32px 110px", minWidth: 0 }}>
          {TopBar}

          <div style={{ animation: "fadeIn .35s ease" }}>
            {view === "dash" && Dashboard}
            {view === "vault" && Vault}
            {view === "doc" && DocDetail}
            {view === "graph" && <GraphView theme={{ isDark, lime, panel, panelBorder, txt, txt2, txt3 }} docTypes={documentTypes} onOpenDocument={openDocument} />}
            {view === "mon" && Monitoring}
            {view === "cal" && (
              <CalendarView theme={{ isDark, lime, panel, panelBorder, txt, txt2, txt3 }} onOpenDocument={openDocument} />
            )}
            {view === "admin" && (
              (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
                <AdminPanel theme={{ isDark, lime, panel, panelBorder, txt, txt2, txt3 }} toast={toast}
                  onTypesChanged={() => documentTypesApi.list().then(setDocumentTypes).catch(() => {})}
                  logoUrl={orgLogoUrl}
                  onLogoChanged={(url) => setOrgLogoUrl(url)} />
              ) : (
                <div style={{ padding: 48, textAlign: "center", color: txt2 }}>{t("admin.accessDenied")}</div>
              )
            )}
          </div>
        </main>
      </div>

      {/* Overlays */}
      {CmdK}
      {Drawer}
      {Wizard}
      {VersionModal}
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
