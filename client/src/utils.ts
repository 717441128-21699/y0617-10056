import type { Document, DocTreeNode } from './types';

export function buildDocTree(docs: Document[]): DocTreeNode[] {
  const map = new Map<string, DocTreeNode>();
  const roots: DocTreeNode[] = [];

  const sorted = [...docs].sort((a, b) => a.sortOrder - b.sortOrder);

  sorted.forEach(doc => {
    map.set(doc.id, {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      children: [],
    });
  });

  sorted.forEach(doc => {
    const node = map.get(doc.id)!;
    if (doc.parentId && map.has(doc.parentId)) {
      map.get(doc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function flattenTree(nodes: DocTreeNode[]): string[] {
  const result: string[] = [];
  const walk = (ns: DocTreeNode[]) => {
    ns.forEach(n => {
      result.push(n.id);
      if (n.children.length > 0) walk(n.children);
    });
  };
  walk(nodes);
  return result;
}

export function getDescendantIds(docs: Document[], id: string): Set<string> {
  const result = new Set<string>();
  const children = docs.filter(d => d.parentId === id);
  children.forEach(c => {
    result.add(c.id);
    getDescendantIds(docs, c.id).forEach(x => result.add(x));
  });
  return result;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
