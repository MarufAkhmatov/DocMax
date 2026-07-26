import { useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { FolderOpen, Pencil, Plus, RotateCcw, Trash2, Users, X, Loader2 } from "lucide-react";
import type { FolderNode, OrgUnitNode } from "@docmax/shared";
import { foldersApi, orgUnitsApi, ApiRequestError } from "@/lib/api";
import type { AdminTheme } from "./AdminPanel";

// TZ-2 §2.4 — Org-struktura canvas (n8n uslubi): unit'lar node, ierarxiya + papka-bog'lanish
// chiziq (edge) sifatida. WorkflowView.tsx (TZ-2 §2.2, hujjat-bog'lanish canvas'i) bilan
// bir xil @xyflow/react naqshi qayta ishlatiladi.

const UNIT_WIDTH = 208;
const UNIT_HEIGHT = 78;
const FOLDER_WIDTH = 176;
const FOLDER_HEIGHT = 56;
const LEVEL_HEIGHT = 170;
const SIBLING_GAP = 250;
const FOLDER_GAP = 190;

type UnitNodeData = {
  kind: "unit";
  name: string;
  code: string | null;
  headUserName: string | null;
  folderCount: number;
  isActive: boolean;
  onRename: (name: string) => void;
  onAddChild: (name: string) => void;
  onToggleClose: () => void;
};
type FolderNodeData = {
  kind: "folder";
  name: string;
  documentCount: number;
  linked: boolean;
  onUnlink: () => void;
};
type OrgFlowNodeData = UnitNodeData | FolderNodeData;

interface OrgEdgeData extends Record<string, unknown> {
  kind: "hierarchy" | "link";
  childId?: string;
  folderId?: string;
}

function UnitFlowNode({ data }: { data: UnitNodeData }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(data.name);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");

  useEffect(() => setName(data.name), [data.name]);

  const submitRename = () => {
    const trimmed = name.trim();
    setRenaming(false);
    if (trimmed && trimmed !== data.name) data.onRename(trimmed);
    else setName(data.name);
  };
  const submitChild = () => {
    const trimmed = childName.trim();
    if (!trimmed) return;
    data.onAddChild(trimmed);
    setChildName("");
    setAddingChild(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl px-3.5 py-3 relative"
      style={{
        background: "rgba(107,180,245,.16)",
        border: "1.5px solid rgba(107,180,245,.55)",
        color: "#fff",
        width: UNIT_WIDTH,
        opacity: data.isActive ? 1 : 0.5,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-center gap-2">
        <Users size={14} className="flex-shrink-0" style={{ color: "#6BB4F5" }} />
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") { setRenaming(false); setName(data.name); }
            }}
            onBlur={submitRename}
            className="flex-1 min-w-0 outline-none rounded px-1 text-[12.5px] font-bold"
            style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}
          />
        ) : (
          <span className="truncate text-[12.5px] font-bold flex-1">
            {data.name}{data.code ? ` (${data.code})` : ""}
          </span>
        )}
      </div>
      <div className="text-[10.5px] font-semibold mt-1 opacity-75 truncate">
        {data.headUserName ?? t("structure.headNone")} · {t("vault.folderMetaPlain", { count: data.folderCount })}
      </div>

      {hovered && !renaming && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <span onClick={() => setRenaming(true)} title={t("common.edit")} className="cursor-pointer"
            style={{ width: 18, height: 18, display: "grid", placeItems: "center", borderRadius: 5, background: "rgba(0,0,0,.4)" }}>
            <Pencil size={10} />
          </span>
          <span onClick={() => setAddingChild((o) => !o)} title={t("structure.newUnit")} className="cursor-pointer"
            style={{ width: 18, height: 18, display: "grid", placeItems: "center", borderRadius: 5, background: "rgba(0,0,0,.4)" }}>
            <Plus size={11} />
          </span>
          <span onClick={data.onToggleClose} title={data.isActive ? t("structure.closeTooltip") : t("structure.reopenTooltip")} className="cursor-pointer"
            style={{ width: 18, height: 18, display: "grid", placeItems: "center", borderRadius: 5, background: "rgba(0,0,0,.4)", color: data.isActive ? "#F07A6B" : "#C6F24E" }}>
            {data.isActive ? <Trash2 size={10} /> : <RotateCcw size={10} />}
          </span>
        </div>
      )}

      {addingChild && (
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitChild(); if (e.key === "Escape") setAddingChild(false); }}
            onBlur={() => { if (!childName.trim()) setAddingChild(false); }}
            placeholder={t("structure.unitNamePlaceholder")}
            className="w-full outline-none rounded px-1.5 py-1 text-[11px] font-semibold"
            style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
          />
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

function OrgFolderFlowNode({ data }: { data: FolderNodeData }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl px-3 py-2.5 relative"
      style={{
        background: "rgba(198,242,78,.12)",
        border: `1.5px ${data.linked ? "solid" : "dashed"} rgba(198,242,78,.55)`,
        color: "#fff",
        width: FOLDER_WIDTH,
        opacity: data.linked ? 1 : 0.8,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-center gap-2">
        <FolderOpen size={13} className="flex-shrink-0" style={{ color: "#C6F24E" }} />
        <span className="truncate text-[12px] font-bold flex-1">{data.name}</span>
      </div>
      <div className="text-[10px] font-semibold mt-0.5 opacity-70">
        {data.linked ? t("vault.folderMetaPlain", { count: data.documentCount }) : t("structure.canvasUnlinkedHint")}
      </div>
      {hovered && data.linked && (
        <span onClick={(e) => { e.stopPropagation(); data.onUnlink(); }} title={t("structure.canvasUnlink")} className="absolute top-1.5 right-1.5 cursor-pointer"
          style={{ width: 16, height: 16, display: "grid", placeItems: "center", borderRadius: 5, background: "rgba(0,0,0,.4)" }}>
          <X size={10} />
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { unit: UnitFlowNode, folder: OrgFolderFlowNode };

/** Chuqurlik bo'yicha qatlamli oddiy daraxt-layout — saqlangan/tashib o'tilgan pozitsiyasi
 * yo'q node'lar uchun boshlang'ich joylashuv (ustma-ust tushmasligi uchun). */
function computeDefaultUnitLayout(units: OrgUnitNode[]): Map<string, { x: number; y: number }> {
  const byParent = new Map<string | null, OrgUnitNode[]>();
  for (const u of units) {
    const list = byParent.get(u.parentId) ?? [];
    list.push(u);
    byParent.set(u.parentId, list);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let frontier = (byParent.get(null) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  let depth = 0;
  const seen = new Set<string>();
  while (frontier.length > 0) {
    frontier.forEach((u, i) => positions.set(u.id, { x: i * SIBLING_GAP, y: depth * LEVEL_HEIGHT }));
    frontier.forEach((u) => seen.add(u.id));
    const next: OrgUnitNode[] = [];
    for (const u of frontier) {
      const children = (byParent.get(u.id) ?? []).filter((c) => !seen.has(c.id)).sort((a, b) => a.sortOrder - b.sortOrder);
      next.push(...children);
    }
    frontier = next;
    depth++;
  }
  return positions;
}

function toUnitNode(u: OrgUnitNode, pos: { x: number; y: number }, handlers: Pick<UnitNodeData, "onRename" | "onAddChild" | "onToggleClose">): Node<OrgFlowNodeData> {
  return {
    id: u.id, type: "unit", position: pos, width: UNIT_WIDTH, height: UNIT_HEIGHT,
    measured: { width: UNIT_WIDTH, height: UNIT_HEIGHT },
    handles: [
      { id: null, type: "target", position: Position.Top, x: UNIT_WIDTH / 2, y: 0, width: 1, height: 1 },
      { id: null, type: "source", position: Position.Bottom, x: UNIT_WIDTH / 2, y: UNIT_HEIGHT, width: 1, height: 1 },
    ],
    data: {
      kind: "unit", name: u.name, code: u.code, headUserName: u.headUserName,
      folderCount: u.folders.length, isActive: u.isActive, ...handlers,
    },
  };
}

function toFolderNode(f: { id: string; name: string; documentCount: number }, pos: { x: number; y: number }, linked: boolean, onUnlink: () => void): Node<OrgFlowNodeData> {
  return {
    id: f.id, type: "folder", position: pos, width: FOLDER_WIDTH, height: FOLDER_HEIGHT,
    measured: { width: FOLDER_WIDTH, height: FOLDER_HEIGHT },
    handles: [
      { id: null, type: "target", position: Position.Top, x: FOLDER_WIDTH / 2, y: 0, width: 1, height: 1 },
      { id: null, type: "source", position: Position.Bottom, x: FOLDER_WIDTH / 2, y: FOLDER_HEIGHT, width: 1, height: 1 },
    ],
    data: { kind: "folder", name: f.name, documentCount: f.documentCount, linked, onUnlink },
  };
}

function OrgStructureCanvasInner({ theme, toast }: { theme: AdminTheme; toast: (msg: string) => void }) {
  const { t } = useTranslation();
  const { isDark, lime, txt, txt2, txt3, panel, panelBorder } = theme;
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<Node<OrgFlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<OrgEdgeData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [unlinkedResults, setUnlinkedResults] = useState<FolderNode[]>([]);
  const [addRootOpen, setAddRootOpen] = useState(false);
  const [addRootName, setAddRootName] = useState("");

  const rebuildEdgesFor = (units: OrgUnitNode[]): Edge<OrgEdgeData>[] => {
    const built: Edge<OrgEdgeData>[] = [];
    for (const u of units) {
      if (u.parentId) {
        built.push({
          id: `hier-${u.parentId}-${u.id}`, source: u.parentId, target: u.id,
          style: { stroke: "#6BB4F5", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#6BB4F5" },
          data: { kind: "hierarchy", childId: u.id },
        });
      }
      for (const f of u.folders) {
        built.push({
          id: `link-${u.id}-${f.id}`, source: u.id, target: f.id,
          style: { stroke: "#C6F24E", strokeWidth: 1.75, strokeDasharray: "4 3" },
          data: { kind: "link", folderId: f.id },
        });
      }
    }
    return built;
  };

  const loadAll = async () => {
    const [units, layout] = await Promise.all([orgUnitsApi.treeAll(), orgUnitsApi.getCanvasLayout()]);
    const savedPos = new Map(layout.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    const defaultPos = computeDefaultUnitLayout(units);
    const linkedFolderIds = new Set(units.flatMap((u) => u.folders.map((f) => f.id)));

    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]));

      const unitNodes = units.map((u) => {
        const pos = prevPos.get(u.id) ?? savedPos.get(u.id) ?? defaultPos.get(u.id) ?? { x: 0, y: 0 };
        return toUnitNode(u, pos, {
          onRename: (name) => renameUnit(u.id, name),
          onAddChild: (name) => addChildUnit(u.id, name),
          onToggleClose: () => toggleClose(u),
        });
      });

      const folderNodes: Node<OrgFlowNodeData>[] = [];
      for (const u of units) {
        const unitPos = prevPos.get(u.id) ?? savedPos.get(u.id) ?? defaultPos.get(u.id) ?? { x: 0, y: 0 };
        u.folders.forEach((f, idx) => {
          const fallback = { x: unitPos.x + (idx - (u.folders.length - 1) / 2) * FOLDER_GAP, y: unitPos.y + 120 };
          const pos = prevPos.get(f.id) ?? savedPos.get(f.id) ?? fallback;
          folderNodes.push(toFolderNode(f, pos, true, () => unlinkFolder(f.id)));
        });
      }

      // Hali hech qaysi unit'ga ulanmagan, chapdan tortib tashlangan papka node'lari — boshqa
      // sabab bilan reload bo'lganda ham yo'qolib qolmasligi uchun saqlanadi.
      const danglingFolders: Node<OrgFlowNodeData>[] = prev.filter(
        (n) => n.data.kind === "folder" && !linkedFolderIds.has(n.id),
      );

      const allNodes = [...unitNodes, ...folderNodes, ...danglingFolders];
      setEdges(rebuildEdgesFor(units));
      return allNodes;
    });
    setLoading(false);
  };

  useEffect(() => {
    loadAll().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (search.trim().length < 2) { setUnlinkedResults([]); return; }
    const timer = window.setTimeout(() => {
      foldersApi.tree({ q: search }).then((res) => setUnlinkedResults(res.filter((f) => !f.orgUnitId))).catch(() => setUnlinkedResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const persistLayout = (currentNodes: Node<OrgFlowNodeData>[]) => {
    const payload = currentNodes.map((n) => ({
      id: n.id, kind: n.data.kind, x: n.position.x, y: n.position.y,
      label: n.data.name, meta: n.data.kind === "unit" ? undefined : String(n.data.documentCount),
    }));
    orgUnitsApi.saveCanvasLayout({ nodes: payload }).catch(() => {});
  };

  const onNodesChange = (changes: NodeChange<Node<OrgFlowNodeData>>[]) => {
    setNodes((nds) => {
      const next = applyNodeChanges(changes, nds);
      if (changes.some((c) => c.type === "position" && !c.dragging)) persistLayout(next);
      return next;
    });
  };

  const onEdgesChange = (changes: EdgeChange<Edge<OrgEdgeData>>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

  const nodeKind = (id: string): "unit" | "folder" | undefined => nodes.find((n) => n.id === id)?.data.kind;

  const onConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceKind = nodeKind(connection.source);
    const targetKind = nodeKind(connection.target);
    try {
      if (sourceKind === "unit" && targetKind === "unit") {
        await orgUnitsApi.move(connection.target, { parentId: connection.source, sortOrder: 0 });
        await loadAll();
      } else if ((sourceKind === "unit" && targetKind === "folder") || (sourceKind === "folder" && targetKind === "unit")) {
        const unitId = sourceKind === "unit" ? connection.source : connection.target;
        const folderId = sourceKind === "folder" ? connection.source : connection.target;
        await orgUnitsApi.setFolderLink(folderId, unitId);
        await loadAll();
      }
      // folder<->folder — e'tiborsiz qoldiriladi
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.generic"));
    }
  };

  const onEdgesDelete = (deleted: Edge<OrgEdgeData>[]) => {
    deleted.forEach((e) => {
      if (e.data?.kind === "link" && typeof e.data.folderId === "string") {
        unlinkFolder(e.data.folderId);
      } else if (e.data?.kind === "hierarchy" && typeof e.data.childId === "string") {
        orgUnitsApi.move(e.data.childId, { parentId: null, sortOrder: 0 }).then(loadAll).catch(() => {});
      }
    });
  };

  const renameUnit = async (id: string, name: string) => {
    try {
      await orgUnitsApi.update(id, { name });
      await loadAll();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitUpdate"));
    }
  };

  const addChildUnit = async (parentId: string, name: string) => {
    try {
      await orgUnitsApi.create({ name, parentId });
      await loadAll();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitCreate"));
    }
  };

  const toggleClose = async (unit: OrgUnitNode) => {
    try {
      if (unit.isActive) {
        if (!window.confirm(t("structure.unitCloseConfirm", { name: unit.name }))) return;
        const moveFoldersToArchive = unit.folders.length > 0 && window.confirm(t("structure.archiveFolderOffer"));
        await orgUnitsApi.close(unit.id, { moveFoldersToArchive });
      } else {
        await orgUnitsApi.reopen(unit.id);
      }
      await loadAll();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitClose"));
    }
  };

  const unlinkFolder = async (folderId: string) => {
    try {
      await orgUnitsApi.setFolderLink(folderId, null);
      await loadAll();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.generic"));
    }
  };

  const handleAddRoot = async () => {
    const name = addRootName.trim();
    if (!name) return;
    try {
      await orgUnitsApi.create({ name, parentId: null });
      setAddRootName("");
      setAddRootOpen(false);
      await loadAll();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : t("errors.orgUnitCreate"));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const payload = JSON.parse(raw) as { id: string; name: string; documentCount: number };
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setNodes((nds) => {
      if (nds.some((n) => n.id === payload.id)) return nds;
      return [...nds, toFolderNode(payload, pos, false, () => unlinkFolder(payload.id))];
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center" style={{ height: "calc(100vh - 240px)" }}><Loader2 size={22} className="animate-spin" style={{ color: txt3 }} /></div>;
  }

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 240px)", minHeight: 460 }}>
      {/* Chap panel — bog'lanmagan papkalarni qidirish */}
      <div className="flex-shrink-0 rounded-2xl p-3 overflow-auto" style={{ width: 220, background: panel, border: `1px solid ${panelBorder}` }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("structure.canvasSearchPlaceholder")}
          className="w-full outline-none rounded-lg text-[12px] font-semibold px-2.5 py-2 mb-2"
          style={{ background: isDark ? "rgba(255,255,255,.06)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
        {unlinkedResults.map((f) => (
          <div key={f.id} draggable
            onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify({ id: f.id, name: f.name, documentCount: f.documentCount }))}
            className="flex items-center gap-2 text-[12px] font-bold px-2 py-1.5 rounded-lg cursor-grab mb-1" style={{ color: txt2 }}>
            <FolderOpen size={13} style={{ color: "#C6F24E" }} /> <span className="truncate">{f.name}</span>
          </div>
        ))}
        {search.trim().length >= 2 && unlinkedResults.length === 0 && (
          <p className="text-[11.5px] font-semibold" style={{ color: txt3 }}>{t("cmdk.noResults")}</p>
        )}
      </div>

      {/* Canvas */}
      <div className="relative flex-1 rounded-2xl overflow-hidden" style={{ border: `1px solid ${panelBorder}` }}
        onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={NODE_TYPES}
          colorMode={isDark ? "dark" : "light"}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable style={{ background: panel }} />
        </ReactFlow>

        {/* Toolbar — yangi ildiz bo'linma */}
        <div className="absolute top-3.5 left-3.5 z-10">
          {addRootOpen ? (
            <div className="flex items-center gap-1.5 rounded-[14px] p-1.5" style={{ background: panel, border: `1px solid ${panelBorder}`, backdropFilter: "blur(16px)" }}>
              <input autoFocus value={addRootName} onChange={(e) => setAddRootName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddRoot(); if (e.key === "Escape") setAddRootOpen(false); }}
                placeholder={t("structure.unitNamePlaceholder")}
                className="outline-none rounded-lg text-[12px] font-semibold px-2.5 py-1.5" style={{ width: 170, background: isDark ? "rgba(255,255,255,.06)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
              <button onClick={handleAddRoot} className="text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer" style={{ background: lime, color: "#0A1600", border: "none" }}>
                {t("common.save")}
              </button>
            </div>
          ) : (
            <button onClick={() => setAddRootOpen(true)}
              className="text-[12px] font-bold px-3.5 py-2 rounded-[14px] cursor-pointer"
              style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2, backdropFilter: "blur(16px)" }}>
              {t("structure.newUnit")}
            </button>
          )}
        </div>

        {/* Legenda */}
        <div className="absolute bottom-3.5 left-3.5 text-[11px] font-bold space-y-1 z-10" style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 14, padding: "10px 14px", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-2" style={{ color: txt2 }}>
            <span className="w-4 h-[2px] rounded-full flex-shrink-0" style={{ background: "#6BB4F5" }} /> {t("structure.canvasLegendHierarchy")}
          </div>
          <div className="flex items-center gap-2" style={{ color: txt2 }}>
            <span className="w-4 h-[2px] rounded-full flex-shrink-0" style={{ background: "#C6F24E" }} /> {t("structure.canvasLegendLink")}
          </div>
        </div>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold z-10 pointer-events-none" style={{ color: txt3 }}>
            {t("structure.noUnitsYet")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrgStructureCanvas(props: { theme: AdminTheme; toast: (msg: string) => void }) {
  return (
    <ReactFlowProvider>
      <OrgStructureCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
