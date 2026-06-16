import axios from 'axios';
import type { User, Space, Document, Version, PermissionLevel, DocType, DocPermission } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': localStorage.getItem('userId') || 'user-1',
  },
});

export const setCurrentUser = (userId: string) => {
  localStorage.setItem('userId', userId);
  api.defaults.headers['X-User-Id'] = userId;
};

export const usersApi = {
  list: (): Promise<User[]> => api.get('/users').then(r => r.data),
};

export const spacesApi = {
  list: (): Promise<Space[]> => api.get('/spaces').then(r => r.data),
  create: (name: string, description?: string): Promise<Space> =>
    api.post('/spaces', { name, description }).then(r => r.data),
};

export const docsApi = {
  list: (spaceId: string): Promise<Document[]> =>
    api.get(`/spaces/${spaceId}/docs`).then(r => r.data),
  get: (id: string): Promise<Document> =>
    api.get(`/docs/${id}`).then(r => r.data),
  create: (params: {
    spaceId: string;
    parentId?: string;
    title: string;
    type: DocType;
    permission?: PermissionLevel;
    allowedUsers?: DocPermission[];
  }): Promise<Document> => api.post('/docs', params).then(r => r.data),
  update: (
    id: string,
    params: Partial<{
      title: string;
      content: string;
      markdown: string;
      parentId: string | null;
      sortOrder: number;
      permission: PermissionLevel;
      allowedUsers: DocPermission[];
      saveVersion: boolean;
      versionMessage: string;
      baseVersion: number;
    }>
  ): Promise<Document> => api.put(`/docs/${id}`, params).then(r => r.data),
  move: (
    id: string,
    params: { parentId?: string | null; sortOrder?: number; spaceId?: string }
  ): Promise<Document> => api.put(`/docs/${id}/move`, params).then(r => r.data),
  delete: (id: string): Promise<{ success: boolean }> =>
    api.delete(`/docs/${id}`).then(r => r.data),
};

export const versionsApi = {
  list: (docId: string): Promise<Version[]> =>
    api.get(`/docs/${docId}/versions`).then(r => r.data),
  get: (id: string): Promise<Version> =>
    api.get(`/versions/${id}`).then(r => r.data),
  diff: (
    docId: string,
    params: { fromVersion: string; toVersion?: string }
  ): Promise<{
    titleDiff: Array<{ value: string; added?: boolean; removed?: boolean }>;
    contentDiff: Array<{ value: string; added?: boolean; removed?: boolean }>;
  }> =>
    api.get(`/docs/${docId}/diff`, { params }).then(r => r.data),
  rollback: (docId: string, versionId: string): Promise<Document> =>
    api.post(`/docs/${docId}/rollback`, { versionId }).then(r => r.data),
};

export const searchApi = {
  search: (q: string, spaceId?: string): Promise<Document[]> =>
    api.get('/search', { params: { q, spaceId } }).then(r => r.data),
};

export default api;
