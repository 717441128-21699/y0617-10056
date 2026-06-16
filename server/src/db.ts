import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Document, Version, Space, User, PermissionLevel, DocType } from './types.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'knowledge.json');

interface DBData {
  users: User[];
  spaces: Space[];
  documents: Document[];
  versions: Version[];
}

let data: DBData = {
  users: [],
  spaces: [],
  documents: [],
  versions: [],
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveData() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }, 100);
}

export function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      data = JSON.parse(raw);
      if (!data.users) data.users = [];
      if (!data.spaces) data.spaces = [];
      if (!data.documents) data.documents = [];
      if (!data.versions) data.versions = [];
      data.documents.forEach(doc => {
        if (doc.version === undefined) (doc as any).version = 1;
      });
    } catch {
      seedInitialData();
    }
  } else {
    seedInitialData();
  }
}

function seedInitialData() {
  const now = Date.now();
  const users: User[] = [
    { id: 'user-1', name: '张三', avatar: '#3B82F6' },
    { id: 'user-2', name: '李四', avatar: '#10B981' },
    { id: 'user-3', name: '王五', avatar: '#F59E0B' },
  ];

  const spaceId = uuidv4();
  const spaces: Space[] = [
    { id: spaceId, name: '团队知识库', description: '团队共享的文档空间', createdAt: now, updatedAt: now },
  ];

  const rootFolderId = uuidv4();
  const doc1Id = uuidv4();
  const folder2Id = uuidv4();

  const documents: Document[] = [
    {
      id: rootFolderId,
      spaceId,
      parentId: null,
      title: '产品文档',
      content: '',
      markdown: '',
      type: 'folder',
      sortOrder: 0,
      permission: 'team',
      allowedUsers: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: doc1Id,
      spaceId,
      parentId: rootFolderId,
      title: '欢迎使用知识库',
      content: '<p>欢迎使用团队内部知识库系统！</p><p>这里是一些核心功能：</p><ul><li>富文本和 Markdown 编辑</li><li>实时协作</li><li>版本历史</li></ul>',
      markdown: '欢迎使用团队内部知识库系统！\n\n这里是一些核心功能：\n\n- 富文本和 Markdown 编辑\n- 实时协作\n- 版本历史',
      type: 'document',
      sortOrder: 0,
      permission: 'team',
      allowedUsers: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: folder2Id,
      spaceId,
      parentId: null,
      title: '技术文档',
      content: '',
      markdown: '',
      type: 'folder',
      sortOrder: 1,
      permission: 'team',
      allowedUsers: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];

  data = { users, spaces, documents, versions: [] };
  saveData();
}

function simpleSearch(query: string, docs: Document[]): (Document & { rank: number })[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: (Document & { rank: number })[] = [];
  const terms = q.split(/\s+/).filter(Boolean);

  docs.forEach(doc => {
    const titleLower = doc.title.toLowerCase();
    const contentLower = (doc.markdown || doc.content || '').toLowerCase();

    let rank = 0;
    terms.forEach(term => {
      if (titleLower.includes(term)) rank += 10;
      if (contentLower.includes(term)) rank += 1;
    });

    if (rank > 0) {
      results.push({ ...doc, rank });
    }
  });

  return results.sort((a, b) => b.rank - a.rank).slice(0, 50);
}

export const dbQueries = {
  getUsers: (): User[] => [...data.users].sort((a, b) => a.name.localeCompare(b.name)),

  getUser: (id: string): User | undefined => data.users.find(u => u.id === id),

  getSpaces: (): Space[] => [...data.spaces].sort((a, b) => a.createdAt - b.createdAt),

  getSpace: (id: string): Space | undefined => data.spaces.find(s => s.id === id),

  createSpace: (name: string, description: string): Space => {
    const id = uuidv4();
    const now = Date.now();
    const space: Space = { id, name, description, createdAt: now, updatedAt: now };
    data.spaces.push(space);
    saveData();
    return space;
  },

  getDocumentsBySpace: (spaceId: string): Document[] =>
    [...data.documents]
      .filter(d => d.spaceId === spaceId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt),

  getDocument: (id: string): Document | undefined => data.documents.find(d => d.id === id),

  createDocument: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Document => {
    const id = uuidv4();
    const now = Date.now();
    const newDoc: Document = { ...doc, id, createdAt: now, updatedAt: now, version: 1 };
    data.documents.push(newDoc);
    saveData();
    return newDoc;
  },

  updateDocument: (id: string, updates: Partial<Document> & { _skipVersionBump?: boolean }): Document | undefined => {
    const idx = data.documents.findIndex(d => d.id === id);
    if (idx < 0) return undefined;

    const current = data.documents[idx];
    const skipBump = (updates as any)._skipVersionBump === true;
    delete (updates as any)._skipVersionBump;

    const merged: Document = {
      ...current,
      ...updates,
      updatedAt: Date.now(),
      version: skipBump ? current.version : current.version + 1,
    };
    data.documents[idx] = merged;
    saveData();
    return merged;
  },

  deleteDocument: (id: string): boolean => {
    const deleteIds = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      data.documents.forEach(d => {
        if (d.parentId && deleteIds.has(d.parentId) && !deleteIds.has(d.id)) {
          deleteIds.add(d.id);
          changed = true;
        }
      });
    }

    const beforeCount = data.documents.length;
    data.documents = data.documents.filter(d => !deleteIds.has(d.id));
    data.versions = data.versions.filter(v => !deleteIds.has(v.docId));
    saveData();
    return data.documents.length < beforeCount;
  },

  createVersion: (docId: string, title: string, content: string, markdown: string, createdBy: string, message?: string): Version => {
    const id = uuidv4();
    const now = Date.now();
    const version: Version = { id, docId, title, content, markdown, createdBy, createdAt: now, message };
    data.versions.push(version);
    saveData();
    return version;
  },

  getVersionsByDoc: (docId: string): Version[] =>
    [...data.versions].filter(v => v.docId === docId).sort((a, b) => b.createdAt - a.createdAt),

  getVersion: (id: string): Version | undefined => data.versions.find(v => v.id === id),

  isDescendantOf: (childId: string, ancestorId: string): boolean => {
    const visited = new Set<string>();
    let currentId: string | null = childId;
    while (currentId) {
      if (currentId === ancestorId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      const doc = data.documents.find(d => d.id === currentId);
      currentId = doc?.parentId || null;
    }
    return false;
  },

  searchDocuments: (query: string, spaceId?: string): (Document & { rank: number })[] => {
    const docs = spaceId ? data.documents.filter(d => d.spaceId === spaceId) : data.documents;
    return simpleSearch(query, docs);
  },
};
