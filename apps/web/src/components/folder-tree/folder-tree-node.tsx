'use client';

import { useState, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { BreadcrumbEntry, FolderNode } from '@docmax/shared';
import { ApiRequestError, foldersApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FolderTreeNodeProps {
  node: FolderNode;
  ancestors: BreadcrumbEntry[];
  selectedId: string | null;
  isAdmin: boolean;
  onSelect: (node: FolderNode, ancestors: BreadcrumbEntry[]) => void;
  onError: (message: string) => void;
}

/** design/docmax-ui-v3.html — .tree .tnode svg (papka ikonkasi, aynan shu path) */
function FolderGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  );
}

export function FolderTreeNode({ node, ancestors, selectedId, isAdmin, onSelect, onError }: FolderTreeNodeProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(node.name);
  const [creatingChild, setCreatingChild] = useState(false);
  const [childNameDraft, setChildNameDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const childrenQuery = useQuery({
    queryKey: ['folders', 'children', node.id],
    queryFn: () => foldersApi.tree({ parentId: node.id }),
    enabled: expanded,
  });

  const nextAncestors = [...ancestors, { id: node.id, name: node.name }];

  function invalidateSelfAndParent() {
    queryClient.invalidateQueries({ queryKey: ['folders', 'children', node.id] });
    queryClient.invalidateQueries({ queryKey: ['folders', 'children', node.parentId] });
  }

  async function submitRename() {
    setRenaming(false);
    if (!nameDraft.trim() || nameDraft === node.name) {
      setNameDraft(node.name);
      return;
    }
    try {
      await foldersApi.update(node.id, { name: nameDraft.trim() });
      invalidateSelfAndParent();
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Nomlashda xato yuz berdi");
      setNameDraft(node.name);
    }
  }

  async function submitCreateChild() {
    const name = childNameDraft.trim();
    setCreatingChild(false);
    setChildNameDraft('');
    if (!name) return;
    try {
      await foldersApi.create({ name, parentId: node.id });
      setExpanded(true);
      queryClient.invalidateQueries({ queryKey: ['folders', 'children', node.id] });
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Papka yaratishda xato yuz berdi");
    }
  }

  async function onDelete() {
    if (!confirm(`"${node.name}" papkasini o'chirasizmi?`)) return;
    try {
      await foldersApi.remove(node.id);
      invalidateSelfAndParent();
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Bo'sh bo'lmagan papkani o'chirib bo'lmaydi");
    }
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const draggedId = e.dataTransfer.getData('text/folder-id');
    if (!draggedId || draggedId === node.id) return;
    try {
      await foldersApi.move(draggedId, { parentId: node.id, sortOrder: 0 });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setExpanded(true);
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Ko'chirishda xato yuz berdi");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, submit: () => void, cancel: () => void) {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') cancel();
  }

  return (
    <div>
      <div
        className={cn('tnode group', selectedId === node.id && 'on', dragOver && 'ring-2 ring-green/60')}
        onClick={() => {
          onSelect(node, ancestors);
          if (node.hasChildren) setExpanded((v) => !v);
        }}
        draggable={isAdmin}
        onDragStart={(e) => e.dataTransfer.setData('text/folder-id', node.id)}
        onDragOver={(e) => {
          if (isAdmin) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <FolderGlyph />
        {renaming ? (
          <input
            autoFocus
            className="min-w-0 flex-1 rounded bg-transparent outline-none"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => onKeyDown(e, submitRename, () => { setRenaming(false); setNameDraft(node.name); })}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        )}
        {!renaming && (node.documentCount > 0 || node.hasChildren) && (
          <span className="cnt group-hover:hidden">{node.documentCount || ''}</span>
        )}
        {isAdmin && !renaming && (
          <span className="hidden shrink-0 items-center gap-1.5 group-hover:flex">
            <button
              title="Ichiga papka qo'shish"
              onClick={(e) => { e.stopPropagation(); setCreatingChild(true); setExpanded(true); }}
              className="rounded p-0.5 text-txt3 hover:text-green-text"
            >
              <Plus size={13} />
            </button>
            <button
              title="Nomini o'zgartirish"
              onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
              className="rounded p-0.5 text-txt3 hover:text-green-text"
            >
              <Pencil size={12} />
            </button>
            <button
              title="O'chirish"
              onClick={(e) => { e.stopPropagation(); void onDelete(); }}
              className="rounded p-0.5 text-txt3 hover:text-red"
            >
              <Trash2 size={12} />
            </button>
          </span>
        )}
      </div>

      {expanded && (
        <div className="sub">
          {creatingChild && (
            <div className="tnode">
              <FolderGlyph />
              <input
                autoFocus
                placeholder="Papka nomi"
                className="min-w-0 flex-1 rounded bg-transparent outline-none"
                value={childNameDraft}
                onChange={(e) => setChildNameDraft(e.target.value)}
                onBlur={submitCreateChild}
                onKeyDown={(e) => onKeyDown(e, submitCreateChild, () => { setCreatingChild(false); setChildNameDraft(''); })}
              />
            </div>
          )}
          {childrenQuery.data?.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              ancestors={nextAncestors}
              selectedId={selectedId}
              isAdmin={isAdmin}
              onSelect={onSelect}
              onError={onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
