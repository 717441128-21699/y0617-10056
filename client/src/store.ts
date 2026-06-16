import { create } from 'zustand';
import type { User, Space, Document, Version, OnlineUser, EditorMode, Draft } from './types';
import { usersApi, spacesApi, docsApi, versionsApi, searchApi, setCurrentUser } from './api';

interface AppState {
  currentUser: User | null;
  users: User[];
  spaces: Space[];
  currentSpaceId: string | null;
  documents: Document[];
  currentDocId: string | null;
  currentDoc: Document | null;
  versions: Version[];
  onlineUsers: OnlineUser[];
  searchResults: Document[];
  searchQuery: string;
  editorMode: EditorMode;
  drafts: Record<string, Draft>;
  loading: boolean;
  error: string | null;
}

interface AppActions {
  init: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  loadSpaces: () => Promise<void>;
  selectSpace: (spaceId: string) => Promise<void>;
  loadDocuments: (spaceId: string) => Promise<void>;
  selectDoc: (docId: string | null) => Promise<void>;
  createDoc: (params: { spaceId: string; parentId?: string; title: string; type: 'folder' | 'document' }) => Promise<Document>;
  updateDoc: (id: string, params: any) => Promise<void>;
  moveDoc: (id: string, params: { parentId?: string | null; sortOrder?: number }) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  createSpace: (name: string, description?: string) => Promise<void>;
  loadVersions: (docId: string) => Promise<void>;
  rollbackToVersion: (docId: string, versionId: string) => Promise<void>;
  setOnlineUsers: (users: OnlineUser[]) => void;
  search: (q: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setEditorMode: (mode: EditorMode) => void;
  saveDraft: (docId: string, draft: Draft) => void;
  getDraft: (docId: string) => Draft | null;
  clearDraft: (docId: string) => void;
}

const DRAFT_KEY = 'kb_drafts';

const loadDrafts = (): Record<string, Draft> => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
  } catch {
    return {};
  }
};

const persistDrafts = (drafts: Record<string, Draft>) => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  currentUser: null,
  users: [],
  spaces: [],
  currentSpaceId: null,
  documents: [],
  currentDocId: null,
  currentDoc: null,
  versions: [],
  onlineUsers: [],
  searchResults: [],
  searchQuery: '',
  editorMode: 'richtext',
  drafts: loadDrafts(),
  loading: false,
  error: null,

  init: async () => {
    try {
      const users = await usersApi.list();
      const storedUserId = localStorage.getItem('userId') || 'user-1';
      const currentUser = users.find(u => u.id === storedUserId) || users[0];
      if (currentUser) {
        setCurrentUser(currentUser.id);
      }
      const spaces = await spacesApi.list();
      set({ users, currentUser, spaces });
      if (spaces.length > 0) {
        await get().selectSpace(spaces[0].id);
      }
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  switchUser: async (userId: string) => {
    setCurrentUser(userId);
    const user = get().users.find(u => u.id === userId);
    if (user) {
      set({ currentUser: user, currentDocId: null, currentDoc: null });
    }
    const spaceId = get().currentSpaceId;
    if (spaceId) {
      await get().loadDocuments(spaceId);
    }
  },

  loadSpaces: async () => {
    const spaces = await spacesApi.list();
    set({ spaces });
  },

  selectSpace: async (spaceId: string) => {
    set({ currentSpaceId: spaceId, currentDocId: null, currentDoc: null });
    await get().loadDocuments(spaceId);
  },

  loadDocuments: async (spaceId: string) => {
    set({ loading: true });
    try {
      const documents = await docsApi.list(spaceId);
      set({ documents, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  selectDoc: async (docId: string | null) => {
    if (!docId) {
      set({ currentDocId: null, currentDoc: null, versions: [] });
      return;
    }
    set({ loading: true, currentDocId: docId });
    try {
      const doc = await docsApi.get(docId);
      set({ currentDoc: doc, loading: false });
      await get().loadVersions(docId);
    } catch (error: any) {
      if (error?.response?.status === 403) {
        set({ currentDocId: null, currentDoc: null, loading: false });
        alert('无权访问此文档');
      } else {
        set({ error: error.message, loading: false });
      }
    }
  },

  createDoc: async (params) => {
    const doc = await docsApi.create(params);
    await get().loadDocuments(params.spaceId);
    return doc;
  },

  updateDoc: async (id: string, params: any) => {
    const doc = await docsApi.update(id, params);
    const docs = get().documents.map(d => d.id === id ? doc : d);
    set({ documents: docs, currentDoc: get().currentDocId === id ? doc : get().currentDoc });
  },

  moveDoc: async (id: string, params) => {
    try {
      await docsApi.move(id, params);
      const spaceId = get().currentSpaceId;
      if (spaceId) {
        await get().loadDocuments(spaceId);
      }
    } catch (error: any) {
      alert(error?.response?.data?.error || '移动失败');
      const spaceId = get().currentSpaceId;
      if (spaceId) {
        await get().loadDocuments(spaceId);
      }
    }
  },

  deleteDoc: async (id: string) => {
    await docsApi.delete(id);
    if (get().currentDocId === id) {
      set({ currentDocId: null, currentDoc: null });
    }
    const spaceId = get().currentSpaceId;
    if (spaceId) {
      await get().loadDocuments(spaceId);
    }
  },

  createSpace: async (name: string, description?: string) => {
    await spacesApi.create(name, description);
    await get().loadSpaces();
  },

  loadVersions: async (docId: string) => {
    try {
      const versions = await versionsApi.list(docId);
      set({ versions });
    } catch {
      set({ versions: [] });
    }
  },

  rollbackToVersion: async (docId: string, versionId: string) => {
    await versionsApi.rollback(docId, versionId);
    await get().selectDoc(docId);
  },

  setOnlineUsers: (users: OnlineUser[]) => {
    set({ onlineUsers: users });
  },

  search: async (q: string) => {
    if (!q.trim()) {
      set({ searchResults: [], searchQuery: q });
      return;
    }
    const results = await searchApi.search(q, get().currentSpaceId || undefined);
    set({ searchResults: results, searchQuery: q });
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),

  setEditorMode: (mode: EditorMode) => set({ editorMode: mode }),

  saveDraft: (docId: string, draft: Draft) => {
    const drafts = { ...get().drafts, [docId]: draft };
    persistDrafts(drafts);
    set({ drafts });
  },

  getDraft: (docId: string) => get().drafts[docId] || null,

  clearDraft: (docId: string) => {
    const { [docId]: _, ...rest } = get().drafts;
    persistDrafts(rest);
    set({ drafts: rest });
  },
}));
