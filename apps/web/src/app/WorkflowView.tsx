import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  addEdge,
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
import { X, FolderOpen, FileText, Loader2 } from "lucide-react";
import type { CanvasNode, DocStatus, DocumentSummary, FolderNode, RelationType } from "@docmax/shared";
import { RELATION_TYPES } from "@docmax/shared";
import { documentsApi, foldersApi, relationsApi, workflowApi, ApiRequestError } from "@/lib/api";
import type { AdminTheme } from "./AdminPanel";

// TZ-2 §2.2 — Workflow canvas (n8n uslubi): chap paneldan papka/hujjat qidirib
// canvas'ga drag qilinadi, ikki node orasiga chiziq tortish = relation yaratish.

const STATUS_COLOR: Record<DocStatus, string> = {
  ACTIVE: "#C6F24E",
  IN_REVIEW: "#F0C24B",
  DRAFT: "#F07A6B",
  EXPIRED: "#8FA0A8",
};

const EDGE_COLOR: Record<RelationType, string> = {
  RELATED: "#9AA6A0",
  PARENT_CHILD: "#6BB4F5",
  AMENDS: "#F0C24B",
  REPLACES: "#F07A6B",
  BASED_ON: "#C6F24E",
};

type FlowNodeData = { label: string; meta?: string; kind: "folder" | "document" };

function FolderFlowNode({ data }: { data: FlowNodeData }) {
  return (
    <div className="rounded-2xl px-4 py-3 text-[12.5px] font-bold" style={{ background: "rgba(179,156,245,.16)", border: "1.5px solid rgba(179,156,245,.5)", color: "#fff", minWidth: 150 }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-center gap-2">
        <FolderOpen size={14} style={{ color: "#B39CF5" }} />
        <span className="truncate">{data.label}</span>
      </div>
      {data.meta && <div className="text-[10.5px] font-semibold mt-1 opacity-70">{data.meta}</div>}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

function DocumentFlowNode({ data }: { data: FlowNodeData }) {
  return (
    <div className="rounded-2xl px-4 py-3 text-[12.5px] font-bold" style={{ background: "rgba(107,180,245,.14)", border: "1.5px solid rgba(107,180,245,.5)", color: "#fff", minWidth: 160 }}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <FileText size={14} style={{ color: "#6BB4F5" }} />
        <span className="truncate">{data.label}</span>
      </div>
      {data.meta && <div className="text-[10.5px] font-semibold mt-1 opacity-70">{data.meta}</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { folder: FolderFlowNode, document: DocumentFlowNode };

const FLOW_NODE_WIDTH = 190;
const FLOW_NODE_HEIGHT = 68;

// React Flow bir node'ni "initialized" deb hisoblashi uchun handle bog'lamlari
// (internals.handleBounds) yoki statik `handles` massivi kerak — birinchisi
// Handle'larning o'z ResizeObserver'i orqali o'lchanadi, lekin dinamik qo'shilgan
// node'larda bu ba'zan yetarlicha tez ishlamaydi va unga ulangan chiziq (edge)
// umuman chizilmay qoladi. Statik `handles` berish bu kutishni butunlay chetlab o'tadi.
function toFlowNode(n: CanvasNode): Node<FlowNodeData> {
  const width = FLOW_NODE_WIDTH, height = FLOW_NODE_HEIGHT;
  return {
    id: n.id, type: n.kind, position: { x: n.x, y: n.y }, width, height,
    measured: { width, height },
    handles: [
      { id: null, type: "target", position: Position.Top, x: width / 2, y: 0, width: 1, height: 1 },
      { id: null, type: "source", position: Position.Bottom, x: width / 2, y: height, width: 1, height: 1 },
    ],
    data: { label: n.label, meta: n.meta, kind: n.kind },
  };
}

interface RelationEdgeData extends Record<string, unknown> {
  relationId: string;
  sourceDocumentId: string;
  type: RelationType;
}

function WorkflowCanvas({ theme, onOpenDocument }: { theme: AdminTheme; onOpenDocument: (id: string) => void }) {
  const { t } = useTranslation();
  const { isDark, lime, txt, txt2, txt3, panel, panelBorder } = theme;
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<RelationEdgeData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [folderResults, setFolderResults] = useState<FolderNode[]>([]);
  const [docResults, setDocResults] = useState<DocumentSummary[]>([]);
  const [connectModal, setConnectModal] = useState<{ source: string; target: string } | null>(null);
  const [connectType, setConnectType] = useState<RelationType>("RELATED");
  const [connectNote, setConnectNote] = useState("");
  const [connectSaving, setConnectSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Saqlangan joylashuvni yuklash
  useEffect(() => {
    workflowApi.getLayout().then((layout) => {
      setNodes(layout.nodes.map(toFlowNode));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Canvas'dagi hujjat node'lari orasidagi mavjud bog'lanishlarni chiziq sifatida yuklash
  useEffect(() => {
    const docIds = nodes.filter((n) => n.type === "document").map((n) => n.id);
    if (docIds.length === 0) {
      setEdges([]);
      return;
    }
    const docIdSet = new Set(docIds);
    Promise.all(docIds.map((id) => relationsApi.list(id).catch(() => [])))
      .then((lists) => {
        const seen = new Set<string>();
        const newEdges: Edge<RelationEdgeData>[] = [];
        lists.forEach((list, i) => {
          const sourceId = docIds[i];
          list.forEach((rel) => {
            if (seen.has(rel.id) || !docIdSet.has(rel.document.id)) return;
            seen.add(rel.id);
            const [a, b] = rel.direction === "OUTGOING" ? [sourceId, rel.document.id] : [rel.document.id, sourceId];
            newEdges.push({
              id: rel.id,
              source: a,
              target: b,
              label: t(`relationType.${rel.type}`),
              style: { stroke: EDGE_COLOR[rel.type], strokeWidth: 2 },
              labelStyle: { fill: isDark ? "#EDF3F0" : "#142018", fontSize: 10, fontWeight: 700 },
              data: { relationId: rel.id, sourceDocumentId: a, type: rel.type },
            });
          });
        });
        setEdges(newEdges);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.map((n) => n.id).join(","), isDark]);

  // Qidiruv (papka + hujjat)
  useEffect(() => {
    if (search.trim().length < 2) { setFolderResults([]); setDocResults([]); return; }
    const timer = window.setTimeout(() => {
      foldersApi.tree({ q: search }).then(setFolderResults).catch(() => setFolderResults([]));
      documentsApi.list({ q: search, limit: 8 }).then((res) => setDocResults(res.items)).catch(() => setDocResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const persistLayout = useCallback((currentNodes: Node<FlowNodeData>[]) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const payload: CanvasNode[] = currentNodes.map((n) => ({
        id: n.id,
        kind: n.data.kind,
        x: n.position.x,
        y: n.position.y,
        label: n.data.label,
        meta: n.data.meta,
      }));
      workflowApi.saveLayout({ nodes: payload }).catch(() => {});
    }, 600);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<Node<FlowNodeData>>[]) => {
    setNodes((nds) => {
      const next = applyNodeChanges(changes, nds);
      if (changes.some((c) => c.type === "position" && !c.dragging)) {
        persistLayout(next);
      }
      return next;
    });
  }, [persistLayout]);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge<RelationEdgeData>>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (sourceNode?.type !== "document" || targetNode?.type !== "document") {
      return; // faqat hujjat-hujjat orasida relation yaratiladi
    }
    setConnectModal({ source: connection.source, target: connection.target });
    setConnectType("RELATED");
    setConnectNote("");
  }, [nodes]);

  const handleConfirmConnect = async () => {
    if (!connectModal) return;
    setConnectSaving(true);
    try {
      const created = await relationsApi.create(connectModal.source, {
        targetDocumentId: connectModal.target,
        type: connectType,
        note: connectNote.trim() || null,
      });
      setEdges((eds) => addEdge({
        id: created.id,
        source: connectModal.source,
        target: connectModal.target,
        label: t(`relationType.${connectType}`),
        style: { stroke: EDGE_COLOR[connectType], strokeWidth: 2 },
        labelStyle: { fill: isDark ? "#EDF3F0" : "#142018", fontSize: 10, fontWeight: 700 },
        data: { relationId: created.id, sourceDocumentId: connectModal.source, type: connectType },
      }, eds));
      setConnectModal(null);
    } catch (err) {
      window.alert(err instanceof ApiRequestError ? err.body.message : t("errors.relationAdd"));
    } finally {
      setConnectSaving(false);
    }
  };

  const onEdgesDelete = useCallback((deleted: Edge<RelationEdgeData>[]) => {
    deleted.forEach((e) => {
      if (e.data) relationsApi.remove(e.data.sourceDocumentId, e.data.relationId).catch(() => {});
    });
  }, []);

  const addNodeToCanvas = (n: CanvasNode) => {
    if (nodes.some((existing) => existing.id === n.id)) return;
    setNodes((nds) => {
      const next = [...nds, toFlowNode(n)];
      persistLayout(next);
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const payload = JSON.parse(raw) as CanvasNode;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNodeToCanvas({ ...payload, x: pos.x, y: pos.y });
  };

  const onNodeDoubleClick = (_: React.MouseEvent, node: Node<FlowNodeData>) => {
    if (node.data.kind === "document") onOpenDocument(node.id);
  };

  const legend = useMemo(() => RELATION_TYPES.map((rt) => ({ type: rt, color: EDGE_COLOR[rt], label: t(`relationType.${rt}`) })), [t]);

  if (loading) {
    return <div className="flex items-center justify-center" style={{ height: "calc(100vh - 240px)" }}><Loader2 size={22} className="animate-spin" style={{ color: txt3 }} /></div>;
  }

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 240px)", minHeight: 460 }}>
      {/* Chap panel — qidiruv */}
      <div className="flex-shrink-0 rounded-2xl p-3 overflow-auto" style={{ width: 220, background: panel, border: `1px solid ${panelBorder}` }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("workflow.searchPlaceholder")}
          className="w-full outline-none rounded-lg text-[12px] font-semibold px-2.5 py-2 mb-2"
          style={{ background: isDark ? "rgba(255,255,255,.06)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
        {folderResults.map((f) => (
          <div key={f.id} draggable
            onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify({
              id: f.id, kind: "folder", x: 0, y: 0, label: f.name, meta: t("vault.folderMetaPlain", { count: f.documentCount }),
            } satisfies CanvasNode))}
            className="flex items-center gap-2 text-[12px] font-bold px-2 py-1.5 rounded-lg cursor-grab mb-1" style={{ color: txt2 }}>
            <FolderOpen size={13} style={{ color: "#B39CF5" }} /> <span className="truncate">{f.name}</span>
          </div>
        ))}
        {docResults.map((d) => (
          <div key={d.id} draggable
            onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify({
              id: d.id, kind: "document", x: 0, y: 0, label: d.title, meta: `${d.docNumber ?? ""} · ${t(`status.${d.status.toLowerCase() === "in_review" ? "review" : d.status.toLowerCase()}`)}`,
            } satisfies CanvasNode))}
            className="flex items-center gap-2 text-[12px] font-bold px-2 py-1.5 rounded-lg cursor-grab mb-1" style={{ color: txt2 }}>
            <FileText size={13} style={{ color: STATUS_COLOR[d.status] }} /> <span className="truncate">{d.title}</span>
          </div>
        ))}
        {search.trim().length >= 2 && folderResults.length === 0 && docResults.length === 0 && (
          <p className="text-[11.5px] font-semibold" style={{ color: txt3 }}>{t("cmdk.noResults")}</p>
        )}
      </div>

      {/* Canvas */}
      <div ref={wrapperRef} className="relative flex-1 rounded-2xl overflow-hidden" style={{ border: `1px solid ${panelBorder}` }}
        onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={NODE_TYPES}
          colorMode={isDark ? "dark" : "light"}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable style={{ background: panel }} />
        </ReactFlow>

        {/* Legend */}
        <div className="absolute top-3.5 left-3.5 text-[11px] font-bold space-y-1 z-10" style={{ background: panel, border: `1px solid ${panelBorder}`, borderRadius: 14, padding: "10px 14px", backdropFilter: "blur(16px)" }}>
          {legend.map((l) => (
            <div key={l.type} className="flex items-center gap-2" style={{ color: txt2 }}>
              <span className="w-4 h-[2px] rounded-full flex-shrink-0" style={{ background: l.color }} /> {l.label}
            </div>
          ))}
        </div>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold z-10 pointer-events-none" style={{ color: txt3 }}>
            {t("workflow.empty")}
          </div>
        )}
      </div>

      {/* Connect modal — relation turi + izoh */}
      {connectModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: "rgba(0,6,14,.55)" }}
          onClick={(e) => e.target === e.currentTarget && setConnectModal(null)}>
          <div className="rounded-2xl p-5" style={{ width: "min(360px, 90vw)", background: isDark ? "#1E1E1E" : "#fff", border: `1px solid ${panelBorder}` }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-['Sora'] text-[14px] font-semibold" style={{ color: txt }}>{t("workflow.connectTitle")}</h3>
              <span onClick={() => setConnectModal(null)} className="cursor-pointer" style={{ color: txt3 }}><X size={16} /></span>
            </div>
            <select value={connectType} onChange={(e) => setConnectType(e.target.value as RelationType)}
              className="w-full outline-none rounded-lg text-[12.5px] font-semibold px-3 py-2 mb-2 cursor-pointer"
              style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }}>
              {RELATION_TYPES.map((rt) => <option key={rt} value={rt}>{t(`relationType.${rt}`)}</option>)}
            </select>
            <input value={connectNote} onChange={(e) => setConnectNote(e.target.value)} placeholder={t("docDetail.relationNotePlaceholder")}
              className="w-full outline-none rounded-lg text-[12.5px] font-semibold px-3 py-2 mb-3"
              style={{ background: isDark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${panelBorder}`, color: txt }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConnectModal(null)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>{t("common.cancel")}</button>
              <button onClick={handleConfirmConnect} disabled={connectSaving}
                className="flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                style={{ background: lime, color: "#0A1600", border: "none" }}>
                {connectSaving && <Loader2 size={12} className="animate-spin" />} {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowView(props: { theme: AdminTheme; onOpenDocument: (id: string) => void }) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas {...props} />
    </ReactFlowProvider>
  );
}
