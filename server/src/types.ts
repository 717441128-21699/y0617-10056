export type PermissionLevel = 'public' | 'team' | 'private';

export type DocType = 'space' | 'folder' | 'document';

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocPermission {
  userId: string;
  canEdit: boolean;
}

export interface Document {
  id: string;
  spaceId: string;
  parentId: string | null;
  title: string;
  content: string;
  markdown: string;
  type: DocType;
  sortOrder: number;
  permission: PermissionLevel;
  allowedUsers: DocPermission[];
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Version {
  id: string;
  docId: string;
  title: string;
  content: string;
  markdown: string;
  createdBy: string;
  createdAt: number;
  message?: string;
}

export interface SearchResult {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  type: DocType;
  updatedAt: number;
  rank: number;
}
