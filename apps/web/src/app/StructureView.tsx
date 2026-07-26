import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import type { OrgStructureSnapshotDetail, OrgUnitNode, RemapPreviewEntry, UserSummary } from "@docmax/shared";
import { authApi, orgUnitsApi, ApiRequestError } from "@/lib/api";
import type { AdminTheme } from "./AdminPanel";
import OrgStructureCanvas from "./OrgStructureCanvas";

// TZ-2 §2.4 — Korxona strukturasi: org-unit daraxti (CRUD, drag&drop, rahbar),
// remapping wizard, struktura snapshot (faqat o'qish). FolderTreeNode'dagi hover-reveal
// naqshi (React state, CSS :hover emas) shu yerda ham qo'llaniladi.

function OrgUnitNodeRow({
  unit, depth, isAdmin, selectedId, onSelect, onChanged, toast, draggingId, setDraggingId,
  lime, txt, txt2, txt3, panel, panelBorder, isDark,
}: {
  unit: OrgUnitNode;
  depth: number;
  isAdmin: boolean;
  selectedId: string | null;
  onSelect: (unit: OrgUnitNode) => void;
  onChanged: () => void;
  toast: (msg: string) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  lime: string; txt: string; txt2: string; txt3: string; panel: string; panelBorder: string; isDark: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<OrgUnitNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(unit.name);

  const loadChildren = () => {
    setLoading(true);
    orgUnitsApi.tree({ parentId: unit.id }).then(setChildren).catch(() => setChildren([])).finally(() => setLoading(false));
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded && children === null) loadChildren();
    setExpanded((x) => !x);
  };

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    try {
      await orgUnitsApi.create({ name, parentId: unit.id });
      setCreateOpen(false);
      setCreateName("");
      if (!expanded) setExpanded(true);
      loadChildren();
      onChanged();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitCreate"));
    }
  };

  const handleRename = async () => {
    const name = editName.trim();
    if (!name || name === unit.name) { setEditOpen(false); setEditName(unit.name); return; }
    try {
      await orgUnitsApi.update(unit.id, { name });
      setEditOpen(false);
      onChanged();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitUpdate"));
    }
  };

  const handleCloseToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unit.isActive) {
      if (!window.confirm(t("structure.unitCloseConfirm", { name: unit.name }))) return;
      const moveFoldersToArchive = unit.folders.length > 0 && window.confirm(t("structure.archiveFolderOffer"));
      try {
        await orgUnitsApi.close(unit.id, { moveFoldersToArchive });
        onChanged();
      } catch (err) {
        toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitClose"));
      }
    } else {
      try {
        await orgUnitsApi.reopen(unit.id);
        onChanged();
      } catch (err) {
        toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitClose"));
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const draggedId = e.dataTransfer.getData("text/org-unit-id") || draggingId;
    setDraggingId(null);
    if (!draggedId || draggedId === unit.id) return;
    try {
      await orgUnitsApi.move(draggedId, { parentId: unit.id, sortOrder: 0 });
      if (!expanded) setExpanded(true);
      loadChildren();
      onChanged();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitMove"));
    }
  };

  const isSelected = unit.id === selectedId;
  const showActions = hovered && isAdmin && !editOpen;

  return (
    <div>
      <div
        draggable={isAdmin}
        onDragStart={(e) => { e.dataTransfer.setData("text/org-unit-id", unit.id); setDraggingId(unit.id); }}
        onDragEnd={() => setDraggingId(null)}
        onDragOver={(e) => { if (isAdmin && draggingId && draggingId !== unit.id) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !editOpen && onSelect(unit)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
          borderRadius: 11, fontSize: 13.5, fontWeight: 600, cursor: "pointer", transition: ".15s",
          opacity: unit.isActive ? 1 : 0.5,
          background: dragOver ? `${lime}22` : isSelected ? `${lime}18` : hovered ? (isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.045)") : "transparent",
          color: isSelected ? lime : txt2,
          border: dragOver ? `1px dashed ${lime}` : "1px solid transparent",
        }}>
        <span onClick={toggle} className="flex-shrink-0" style={{ display: "grid", placeItems: "center", width: 14, height: 14 }}>
          {unit.hasChildren || children ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
        </span>
        <Users size={14} className="flex-shrink-0" />
        {editOpen ? (
          <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setEditOpen(false); setEditName(unit.name); } }}
            onBlur={handleRename}
            className="flex-1 outline-none rounded px-1.5 py-0.5 min-w-0"
            style={{ background: isDark ? "rgba(255,255,255,.09)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
        ) : (
          <span className="flex-1 truncate">{unit.name}{unit.code ? ` (${unit.code})` : ""}</span>
        )}
        {showActions ? (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span onClick={(e) => { e.stopPropagation(); if (!expanded) { setExpanded(true); if (children === null) loadChildren(); } setCreateOpen((o) => !o); }}
              title={t("structure.newUnit")}
              style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, color: txt3 }}>
              <Plus size={13} />
            </span>
            <span onClick={(e) => { e.stopPropagation(); setEditName(unit.name); setEditOpen(true); }}
              title={t("common.edit")}
              style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, color: txt3 }}>
              <Pencil size={12} />
            </span>
            <span onClick={handleCloseToggle}
              title={unit.isActive ? t("structure.closeTooltip") : t("structure.reopenTooltip")}
              style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, color: unit.isActive ? "#F07A6B" : lime }}>
              {unit.isActive ? <Trash2 size={12} /> : <RotateCcw size={12} />}
            </span>
          </div>
        ) : !editOpen && (
          <span className="text-[11px] font-bold flex-shrink-0" style={{ color: txt3 }}>{unit.folders.length}</span>
        )}
      </div>

      {createOpen && (
        <div style={{ marginLeft: 20 + depth * 14, marginTop: 4, marginBottom: 4 }} onClick={(e) => e.stopPropagation()}>
          <input autoFocus value={createName} onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreateOpen(false); }}
            placeholder={t("structure.unitNamePlaceholder")}
            className="w-full outline-none rounded-lg text-[12px] font-semibold px-2.5 py-1.5"
            style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
        </div>
      )}

      {expanded && (
        <div style={{ marginLeft: 20, borderLeft: `1.5px solid ${panelBorder}`, paddingLeft: 6 }}>
          {loading ? (
            <div style={{ padding: "6px 10px", fontSize: 12, color: txt3 }}>…</div>
          ) : (
            children?.map((c) => (
              <OrgUnitNodeRow key={c.id} unit={c} depth={depth + 1} isAdmin={isAdmin}
                selectedId={selectedId} onSelect={onSelect} onChanged={loadChildren} toast={toast}
                draggingId={draggingId} setDraggingId={setDraggingId}
                lime={lime} txt={txt} txt2={txt2} txt3={txt3} panel={panel} panelBorder={panelBorder} isDark={isDark} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function RemapWizardModal({ unit, onClose, toast, theme }: { unit: OrgUnitNode; onClose: () => void; toast: (msg: string) => void; theme: AdminTheme }) {
  const { t } = useTranslation();
  const { lime, txt, txt2, txt3, panel, panelBorder, isDark } = theme;
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [entries, setEntries] = useState<RemapPreviewEntry[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    orgUnitsApi.remapPreview(unit.id)
      .then(setEntries)
      .catch((err) => toast(err instanceof ApiRequestError ? err.body.message : t("errors.generic")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id]);

  const toggleExclude = (folderId: string) =>
    setExcluded((prev) => { const next = new Set(prev); next.has(folderId) ? next.delete(folderId) : next.add(folderId); return next; });

  const handleApply = async () => {
    const moves = entries.filter((e) => !e.unchanged && !excluded.has(e.folderId)).map((e) => ({ folderId: e.folderId, newParentId: e.proposedParentId }));
    if (moves.length === 0) { onClose(); return; }
    setApplying(true);
    try {
      await orgUnitsApi.remapApply(unit.id, { moves });
      onClose();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.generic"));
    } finally {
      setApplying(false);
    }
  };

  const changedEntries = entries.filter((e) => !e.unchanged);

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-auto"
      style={{ background: isDark ? "rgba(0,6,14,.55)" : "rgba(20,40,32,.3)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="my-[6vh] overflow-hidden" style={{ width: "min(640px, 94vw)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}`, borderRadius: 20, boxShadow: "0 32px 80px rgba(0,0,0,.55)", padding: 26 }}>
        <h2 className="font-['Sora'] text-[17px] font-semibold mb-1" style={{ color: txt }}>{t("structure.remapWizardTitle")}</h2>
        <p className="text-[12px] font-semibold mb-4" style={{ color: txt2 }}>{t("structure.remapWizardHint")}</p>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: txt3 }}><Loader2 size={20} className="animate-spin" /></div>
        ) : changedEntries.length === 0 ? (
          <p className="text-[12.5px] font-semibold mb-6" style={{ color: txt3 }}>{t("structure.remapNoChanges")}</p>
        ) : (
          <div className="space-y-2 mb-4">
            {changedEntries.map((entry) => (
              <label key={entry.folderId} className="flex items-start gap-2.5 rounded-[13px] p-3 cursor-pointer" style={{ border: `1px solid ${panelBorder}` }}>
                <input type="checkbox" checked={!excluded.has(entry.folderId)} onChange={() => toggleExclude(entry.folderId)} className="mt-0.5" />
                <span className="text-[12.5px] font-semibold" style={{ color: txt }}>
                  <strong>{entry.folderName}</strong> → {t("structure.remapEntryLabel", { path: entry.proposedPathLabel })}
                  <br />
                  <span style={{ color: txt3, fontSize: 11 }}>{entry.currentPathLabel} → {entry.proposedPathLabel}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="text-[12.5px] font-bold px-4 py-2.5 rounded-[12px] cursor-pointer"
            style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>
            {t("common.cancel")}
          </button>
          <button onClick={handleApply} disabled={applying || loading}
            className="text-[12.5px] font-bold px-4 py-2.5 rounded-[12px] cursor-pointer flex items-center gap-1.5"
            style={{ background: lime, border: "none", color: "#0A1600", opacity: applying ? 0.6 : 1 }}>
            {applying && <Loader2 size={13} className="animate-spin" />}
            {t("structure.remapApply")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SnapshotViewerNode({ id, byParent, byId }: { id: string; byParent: Map<string | null, { id: string; name: string }[]>; byId: Map<string, { name: string }> }) {
  const children = byParent.get(id) ?? [];
  const node = byId.get(id);
  return (
    <div style={{ marginLeft: 14 }}>
      <div className="text-[12.5px] font-semibold py-1">{node?.name}</div>
      {children.map((c) => <SnapshotViewerNode key={c.id} id={c.id} byParent={byParent} byId={byId} />)}
    </div>
  );
}

export default function StructureView({ theme, toast, isAdmin }: { theme: AdminTheme; toast: (msg: string) => void; isAdmin: boolean }) {
  const { t } = useTranslation();
  const { lime, txt, txt2, txt3, panel, panelBorder, isDark } = theme;

  const [viewMode, setViewMode] = useState<"tree" | "canvas">("tree");
  const [roots, setRoots] = useState<OrgUnitNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrgUnitNode | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [savingHead, setSavingHead] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [wizardUnit, setWizardUnit] = useState<OrgUnitNode | null>(null);
  const [createRootOpen, setCreateRootOpen] = useState(false);
  const [createRootName, setCreateRootName] = useState("");

  const [snapshotDate, setSnapshotDate] = useState("");
  const [snapshot, setSnapshot] = useState<OrgStructureSnapshotDetail | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const loadRoots = () => {
    setLoading(true);
    orgUnitsApi.tree({ parentId: null }).then(setRoots).catch(() => setRoots([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoots();
    if (isAdmin) authApi.listUsers().then(setUsers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleCreateRoot = async () => {
    const name = createRootName.trim();
    if (!name) return;
    try {
      await orgUnitsApi.create({ name, parentId: null });
      setCreateRootOpen(false);
      setCreateRootName("");
      loadRoots();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitCreate"));
    }
  };

  const handleHeadChange = async (headUserId: string) => {
    if (!selected) return;
    setSavingHead(true);
    try {
      const updated = await orgUnitsApi.update(selected.id, { headUserId: headUserId || null });
      setSelected(updated);
      loadRoots();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitUpdate"));
    } finally {
      setSavingHead(false);
    }
  };

  const loadSnapshot = () => {
    if (!snapshotDate) return;
    setSnapshotLoading(true);
    orgUnitsApi.snapshotAt(snapshotDate).then(setSnapshot).catch(() => setSnapshot(null)).finally(() => setSnapshotLoading(false));
  };

  const glass: React.CSSProperties = { background: panel, border: `1px solid ${panelBorder}`, backdropFilter: "blur(16px)", borderRadius: 20 };

  const snapshotByParent = new Map<string | null, { id: string; name: string }[]>();
  const snapshotById = new Map<string, { name: string }>();
  if (snapshot) {
    for (const u of snapshot.data.orgUnits) {
      snapshotById.set(u.id, { name: u.name });
      const list = snapshotByParent.get(u.parentId) ?? [];
      list.push({ id: u.id, name: u.name });
      snapshotByParent.set(u.parentId, list);
    }
  }

  return (
    <div>
      <div className="flex p-1 gap-0.5 rounded-[10px] mb-3 w-fit"
        style={{ background: isDark ? "rgba(26,26,26,.92)" : "rgba(255,255,255,.95)", border: `1px solid ${panelBorder}` }}>
        {([["tree", t("structure.viewTree")], ["canvas", t("structure.viewCanvas")]] as const).map(([m, label]) => (
          <span key={m} onClick={() => setViewMode(m)}
            className="text-[11px] font-extrabold px-3 py-[5px] rounded-lg cursor-pointer"
            style={viewMode === m ? { background: isDark ? "rgba(255,255,255,.12)" : "#fff", color: txt } : { color: txt3 }}>
            {label}
          </span>
        ))}
      </div>

      {viewMode === "canvas" ? (
        <OrgStructureCanvas theme={theme} toast={toast} />
      ) : (
      <>
      <div className="grid gap-4" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* Org-unit daraxti */}
        <div style={{ ...glass, padding: 18 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-['Sora'] text-[15px] font-semibold" style={{ color: txt }}>{t("structure.title")}</h2>
            {isAdmin && (
              <span onClick={() => setCreateRootOpen((o) => !o)} title={t("structure.newUnit")}
                style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 8, cursor: "pointer", color: txt3, border: `1px solid ${panelBorder}` }}>
                <Plus size={14} />
              </span>
            )}
          </div>
          {createRootOpen && (
            <input autoFocus value={createRootName} onChange={(e) => setCreateRootName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoot(); if (e.key === "Escape") setCreateRootOpen(false); }}
              placeholder={t("structure.unitNamePlaceholder")}
              className="w-full outline-none rounded-lg text-[12px] font-semibold px-2.5 py-1.5 mb-3"
              style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
          )}
          {loading ? (
            <div style={{ padding: 12, color: txt3, fontSize: 12 }}>…</div>
          ) : roots.length === 0 ? (
            <p className="text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("structure.noUnitsYet")}</p>
          ) : (
            roots.map((u) => (
              <OrgUnitNodeRow key={u.id} unit={u} depth={0} isAdmin={isAdmin}
                selectedId={selected?.id ?? null} onSelect={setSelected} onChanged={loadRoots} toast={toast}
                draggingId={draggingId} setDraggingId={setDraggingId}
                lime={lime} txt={txt} txt2={txt2} txt3={txt3} panel={panel} panelBorder={panelBorder} isDark={isDark} />
            ))
          )}
        </div>

        {/* Tanlangan bo'linma tafsiloti */}
        <div style={{ ...glass, padding: 22 }}>
          {!selected ? (
            <p className="text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("structure.hint")}</p>
          ) : (
            <>
              <h2 className="font-['Sora'] text-[16px] font-semibold mb-1" style={{ color: txt }}>{selected.name}</h2>
              {selected.code && <p className="text-[12px] font-semibold mb-4" style={{ color: txt3 }}>{selected.code}</p>}

              <div className="mb-5">
                <p className="text-[11px] font-extrabold uppercase tracking-wide mb-2" style={{ color: txt3 }}>{t("structure.headLabel")}</p>
                {isAdmin ? (
                  <select value={selected.headUserId ?? ""} disabled={savingHead} onChange={(e) => handleHeadChange(e.target.value)}
                    className="text-[12.5px] font-bold rounded-lg px-3 py-2" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt }}>
                    <option value="">{t("structure.headNone")}</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                ) : (
                  <p className="text-[12.5px] font-semibold" style={{ color: txt }}>{selected.headUserName ?? t("structure.headNone")}</p>
                )}
              </div>

              <div className="mb-5">
                <p className="text-[11px] font-extrabold uppercase tracking-wide mb-2" style={{ color: txt3 }}>{t("structure.folderMapping")}</p>
                {selected.folders.length === 0 ? (
                  <p className="text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("structure.folderMappingEmpty")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selected.folders.map((f) => (
                      <span key={f.id} className="text-[11.5px] font-bold px-3 py-1.5 rounded-full"
                        style={{ background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.045)", color: txt2 }}>
                        {f.name} · {f.documentCount}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {isAdmin && (
                <button onClick={() => setWizardUnit(selected)}
                  className="text-[12.5px] font-bold px-4 py-2.5 rounded-[12px] cursor-pointer"
                  style={{ background: lime, border: "none", color: "#0A1600" }}>
                  {t("structure.remapWizardTitle")}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Struktura snapshot — faqat o'qish */}
      <div style={{ ...glass, padding: 22, marginTop: 20 }}>
        <h2 className="font-['Sora'] text-[15px] font-semibold mb-1" style={{ color: txt }}>{t("structure.snapshotViewerTitle")}</h2>
        <p className="text-[12px] font-semibold mb-4" style={{ color: txt3 }}>{t("structure.snapshotReadOnlyNote")}</p>
        <div className="flex items-center gap-2 mb-4">
          <input type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)}
            className="text-[12.5px] font-bold rounded-lg px-3 py-2" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt }} />
          <button onClick={loadSnapshot} disabled={!snapshotDate || snapshotLoading}
            className="text-[12.5px] font-bold px-4 py-2 rounded-[12px] cursor-pointer"
            style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2, opacity: !snapshotDate ? 0.5 : 1 }}>
            {t("structure.snapshotDatePicker")}
          </button>
        </div>
        {snapshotLoading ? (
          <Loader2 size={18} className="animate-spin" style={{ color: txt3 }} />
        ) : snapshot ? (
          <div>{(snapshotByParent.get(null) ?? []).map((u) => <SnapshotViewerNode key={u.id} id={u.id} byParent={snapshotByParent} byId={snapshotById} />)}</div>
        ) : snapshotDate ? (
          <p className="text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("structure.snapshotEmpty")}</p>
        ) : null}
      </div>

      {wizardUnit && (
        <RemapWizardModal unit={wizardUnit} onClose={() => { setWizardUnit(null); loadRoots(); }} toast={toast} theme={theme} />
      )}
      </>
      )}
    </div>
  );
}
