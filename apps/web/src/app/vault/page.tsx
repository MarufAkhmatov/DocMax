'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Folder as FolderIcon, Search } from 'lucide-react';
import type { BreadcrumbEntry, FolderNode } from '@docmax/shared';
import { ApiRequestError, foldersApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { AppRail } from '@/components/app-rail';
import { RequireAuth } from '@/components/require-auth';
import { FolderTree } from '@/components/folder-tree/folder-tree';
import { cn } from '@/lib/utils';

interface Selection {
  node: FolderNode;
  ancestors: BreadcrumbEntry[];
}

function FolderCard({ node, onOpen }: { node: FolderNode; onOpen: () => void }) {
  return (
    <div className={cn('folder', node.color === 'green' && 'acc')} onClick={onOpen}>
      <span className="fbadge">{node.documentCount} hujjat</span>
      <div className="papers">
        <div className="sheet s1">
          <i /><i /><i /><i />
        </div>
        <div className="sheet s2">
          <i /><i /><i /><i />
        </div>
        <div className="sheet s3">
          <i /><i /><i /><i />
        </div>
      </div>
      <div className="fname">{node.name}</div>
      <div className="fmeta">
        <span className="fdot" />
        {node.hasChildren ? "Ichida papkalar bor" : "Ichki papkasi yo'q"}
      </div>
    </div>
  );
}

function VaultContent() {
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [creatingChild, setCreatingChild] = useState(false);
  const [childNameDraft, setChildNameDraft] = useState('');
  const [error, setError] = useState<string>();

  function onSelect(node: FolderNode, ancestors: BreadcrumbEntry[]) {
    setSelected({ node, ancestors });
  }

  const childrenQuery = useQuery({
    queryKey: ['folders', 'children', selected?.node.id ?? null],
    queryFn: () => foldersApi.tree({ parentId: selected?.node.id ?? null }),
    enabled: !!selected,
  });

  async function submitCreateChild() {
    const name = childNameDraft.trim();
    setCreatingChild(false);
    setChildNameDraft('');
    if (!name || !selected) return;
    try {
      await foldersApi.create({ name, parentId: selected.node.id });
      queryClient.invalidateQueries({ queryKey: ['folders', 'children', selected.node.id] });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Papka yaratishda xato yuz berdi");
    }
  }

  const crumb = selected ? [...selected.ancestors, { id: selected.node.id, name: selected.node.name }] : [];
  const initials = (user?.fullName ?? '??')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="shell">
      <AppRail />
      <FolderTree selectedId={selected?.node.id ?? null} onSelect={onSelect} />

      <main className="main">
        <div className="top">
          <span className="crumb">
            Vault
            {crumb.map((c) => (
              <span key={c.id}>
                {' / '}
                <b>{c.name}</b>
              </span>
            ))}
          </span>
          <div className="search">
            <Search size={15} />
            <span>Qidirish: nom, raqam yoki ma&apos;no bo&apos;yicha...</span>
            <kbd>⌘K</kbd>
          </div>
          <div className="ava" title={user?.fullName}>
            {initials}
          </div>
        </div>

        {!selected ? (
          <div className="card flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
            <FolderIcon size={32} className="text-txt3" />
            <p className="text-[13px] font-semibold text-txt2">
              Boshlash uchun chapdagi daraxtdan papka tanlang
            </p>
          </div>
        ) : (
          <>
            <div className="htitle">
              <div>
                <h1>{selected.node.name}</h1>
                <p>
                  {selected.node.documentCount} hujjat
                  {selected.node.description ? ` · ${selected.node.description}` : ''}
                </p>
              </div>
              {isAdmin && (
                <button className="tbtn pri" onClick={() => setCreatingChild(true)}>
                  <ChevronRight size={14} className="rotate-90" />
                  Yangi papka
                </button>
              )}
            </div>

            {error && (
              <p className="mb-4 rounded-[12px] border border-red/30 bg-red/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-red">
                {error}
              </p>
            )}

            <div className="folders">
              {creatingChild && (
                <div className="folder">
                  <div className="papers">
                    <div className="sheet s1"><i /><i /><i /><i /></div>
                    <div className="sheet s2"><i /><i /><i /><i /></div>
                    <div className="sheet s3"><i /><i /><i /><i /></div>
                  </div>
                  <input
                    autoFocus
                    placeholder="Papka nomi"
                    className="fname w-full bg-transparent outline-none"
                    value={childNameDraft}
                    onChange={(e) => setChildNameDraft(e.target.value)}
                    onBlur={submitCreateChild}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitCreateChild();
                      if (e.key === 'Escape') { setCreatingChild(false); setChildNameDraft(''); }
                    }}
                  />
                </div>
              )}
              {childrenQuery.data?.map((child) => (
                <FolderCard key={child.id} node={child} onOpen={() => onSelect(child, crumb)} />
              ))}
            </div>

            {childrenQuery.data?.length === 0 && !creatingChild && (
              <div className="card p-10 text-center">
                <p className="text-[12.5px] font-semibold text-txt3">
                  Bu papkada {selected.node.documentCount} ta hujjat. Hujjatlar ro&apos;yxati keyingi bosqichda
                  qo&apos;shiladi.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function VaultPage() {
  return (
    <RequireAuth>
      <VaultContent />
    </RequireAuth>
  );
}
