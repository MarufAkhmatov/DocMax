'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import type { BreadcrumbEntry, FolderNode } from '@docmax/shared';
import { ApiRequestError, foldersApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { FolderTreeNode } from './folder-tree-node';

interface FolderTreeProps {
  selectedId: string | null;
  onSelect: (node: FolderNode, ancestors: BreadcrumbEntry[]) => void;
}

export function FolderTree({ selectedId, onSelect }: FolderTreeProps) {
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [error, setError] = useState<string>();
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [rootNameDraft, setRootNameDraft] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(undefined), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const treeQuery = useQuery({
    queryKey: debouncedQuery ? ['folders', 'search', debouncedQuery] : ['folders', 'children', null],
    queryFn: () => foldersApi.tree(debouncedQuery ? { q: debouncedQuery } : { parentId: null }),
  });

  async function submitCreateRoot() {
    const name = rootNameDraft.trim();
    setCreatingRoot(false);
    setRootNameDraft('');
    if (!name) return;
    try {
      await foldersApi.create({ name, parentId: null });
      queryClient.invalidateQueries({ queryKey: ['folders', 'children', null] });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Papka yaratishda xato yuz berdi");
    }
  }

  return (
    <aside className="tree">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="!my-0">Papkalar</h3>
        {isAdmin && (
          <button title="Yangi papka" onClick={() => setCreatingRoot(true)} className="ric !h-7 !w-7">
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="search mb-3 !max-w-none">
        <Search size={13} className="shrink-0" />
        <input placeholder="Qidirish..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && (
        <p className="mb-2 rounded-[10px] border border-red/30 bg-red/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-red">
          {error}
        </p>
      )}

      {creatingRoot && (
        <div className="tnode">
          <input
            autoFocus
            placeholder="Papka nomi"
            className="min-w-0 flex-1 rounded bg-transparent outline-none"
            value={rootNameDraft}
            onChange={(e) => setRootNameDraft(e.target.value)}
            onBlur={submitCreateRoot}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitCreateRoot();
              if (e.key === 'Escape') { setCreatingRoot(false); setRootNameDraft(''); }
            }}
          />
        </div>
      )}

      {treeQuery.isLoading && <p className="px-2.5 text-[12px] text-txt3">Yuklanmoqda...</p>}
      {treeQuery.data?.length === 0 && !creatingRoot && (
        <p className="px-2.5 text-[12px] text-txt3">{debouncedQuery ? 'Hech narsa topilmadi' : "Hali papka yo'q"}</p>
      )}
      {treeQuery.data?.map((node) => (
        <FolderTreeNode
          key={node.id}
          node={node}
          ancestors={[]}
          selectedId={selectedId}
          isAdmin={isAdmin}
          onSelect={onSelect}
          onError={setError}
        />
      ))}
    </aside>
  );
}
