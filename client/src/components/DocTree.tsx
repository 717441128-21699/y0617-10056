import { useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useAppStore } from '../store';
import { buildDocTree, getDescendantIds } from '../utils';
import type { DocTreeNode, Document } from '../types';

interface DragItem {
  id: string;
  type: 'folder' | 'document';
}

function TreeNode({ node, depth }: { node: DocTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const { currentDocId, selectDoc, documents, moveDoc, createDoc, deleteDoc, currentSpaceId } = useAppStore();
  const doc = documents.find(d => d.id === node.id);

  const isActive = currentDocId === node.id;

  const [{ isDragging }, drag] = useDrag<DragItem, void, { isDragging: boolean }>(() => ({
    type: 'DOC_ITEM',
    item: { id: node.id, type: node.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [node.id, node.type]);

  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: 'DOC_ITEM',
    canDrop: (item) => {
      if (item.id === node.id) return false;
      const dragDescendants = getDescendantIds(documents, item.id);
      if (dragDescendants.has(node.id)) return false;
      return true;
    },
    drop: (item, monitor) => {
      const didDrop = monitor.didDrop();
      if (didDrop) return;
      if (node.type === 'folder') {
        const siblings = documents.filter(d => d.parentId === node.id);
        moveDoc(item.id, { parentId: node.id, sortOrder: siblings.length });
      } else {
        const targetDoc = documents.find(d => d.id === node.id);
        if (targetDoc) {
          const siblings = documents.filter(d => d.parentId === targetDoc.parentId);
          const idx = siblings.findIndex(s => s.id === node.id);
          moveDoc(item.id, { parentId: targetDoc.parentId, sortOrder: idx });
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [node.id, node.type, documents]);

  const handleAddChild = () => {
    if (!currentSpaceId) return;
    const title = prompt('文档名称:');
    if (title?.trim()) {
      createDoc({
        spaceId: currentSpaceId,
        parentId: node.id,
        title: title.trim(),
        type: 'document',
      }).then(doc => selectDoc(doc.id));
    }
  };

  const handleAddFolder = () => {
    if (!currentSpaceId) return;
    const title = prompt('文件夹名称:');
    if (title?.trim()) {
      createDoc({
        spaceId: currentSpaceId,
        parentId: node.id,
        title: title.trim(),
        type: 'folder',
      });
    }
  };

  const handleDelete = () => {
    if (confirm(`确定要删除「${node.title}」吗？`)) {
      deleteDoc(node.id);
    }
  };

  return (
    <div>
      <div
        ref={(el) => drag(drop(el))}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={`group relative flex items-center gap-1 py-1.5 pr-2 cursor-pointer rounded mx-1
          ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}
          ${isDragging ? 'opacity-50' : ''}
          ${isOver && canDrop ? 'bg-blue-100 border-2 border-blue-400 border-dashed' : ''}
        `}
        onClick={() => node.type === 'folder' ? setExpanded(!expanded) : selectDoc(node.id)}
      >
        {node.type === 'folder' && (
          <span className="w-4 text-gray-400 flex items-center justify-center text-xs">
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {node.type !== 'folder' && <span className="w-4" />}

        {node.type === 'folder' ? (
          <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}

        <span className="truncate text-sm flex-1">{node.title}</span>

        {doc?.permission === 'private' && (
          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        )}
        {doc?.permission === 'public' && (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}

        <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
          {node.type === 'folder' && (
            <>
              <button
                onClick={e => { e.stopPropagation(); handleAddFolder(); }}
                className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
                title="新建子文件夹"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path stroke="#fff" strokeWidth="2" d="M8 11h4M10 9v4" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleAddChild(); }}
                className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
                title="新建子文档"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={e => { e.stopPropagation(); handleDelete(); }}
            className="p-0.5 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
            title="删除"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {node.type === 'folder' && expanded && node.children.length > 0 && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocTree() {
  const documents = useAppStore(s => s.documents);
  const tree = buildDocTree(documents);

  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-400">
        暂无文档，点击上方按钮创建
      </div>
    );
  }

  return (
    <div className="py-2">
      {tree.map(node => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
