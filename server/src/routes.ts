import { Router, Request, Response } from 'express';
import * as Diff from 'diff';
import { dbQueries } from './db.js';
import type { PermissionLevel, DocPermission, DocType, Document } from './types.js';

const router = Router();

const getCurrentUserId = (req: Request): string => {
  return (req.headers['x-user-id'] as string) || 'user-1';
};

function canUserAccess(doc: Document, userId: string): boolean {
  if (doc.permission === 'public') return true;
  if (doc.permission === 'team') return true;
  if (doc.createdBy === userId) return true;
  if (doc.allowedUsers && doc.allowedUsers.some(u => u.userId === userId)) return true;
  return false;
}

function filterDocsForUser(docs: Document[], userId: string): Document[] {
  return docs.filter(doc => {
    if (doc.type === 'folder') return true;
    return canUserAccess(doc, userId);
  });
}

function stripPrivateContent(doc: Document, userId: string): Document {
  if (!canUserAccess(doc, userId)) {
    return {
      ...doc,
      title: '',
      content: '',
      markdown: '',
    };
  }
  return doc;
}

router.get('/users', (_req, res) => {
  res.json(dbQueries.getUsers());
});

router.get('/spaces', (_req, res) => {
  res.json(dbQueries.getSpaces());
});

router.post('/spaces', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const space = dbQueries.createSpace(name, description || '');
  res.json(space);
});

router.get('/spaces/:spaceId/docs', (req, res) => {
  const userId = getCurrentUserId(req);
  const docs = dbQueries.getDocumentsBySpace(req.params.spaceId);
  res.json(filterDocsForUser(docs, userId));
});

router.get('/docs/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  const doc = dbQueries.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!canUserAccess(doc, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(doc);
});

router.post('/docs', (req, res) => {
  const userId = getCurrentUserId(req);
  const { spaceId, parentId, title, type, permission, allowedUsers } = req.body;
  if (!spaceId || !title || !type) return res.status(400).json({ error: 'spaceId, title, and type are required' });

  const docs = dbQueries.getDocumentsBySpace(spaceId);
  const siblings = parentId
    ? docs.filter(d => d.parentId === parentId)
    : docs.filter(d => d.parentId === null);
  const sortOrder = siblings.length;

  const doc = dbQueries.createDocument({
    spaceId,
    parentId: parentId || null,
    title,
    content: '',
    markdown: '',
    type: type as DocType,
    sortOrder,
    permission: (permission as PermissionLevel) || 'team',
    allowedUsers: (allowedUsers as DocPermission[]) || [],
    createdBy: userId,
    updatedBy: userId,
  });
  res.status(201).json(doc);
});

function mergeText(serverCurrent: string, incoming: string): string {
  if (serverCurrent === incoming) return serverCurrent;
  const diff = Diff.diffLines(serverCurrent, incoming);
  const result: string[] = [];
  for (const part of diff) {
    if (part.added) {
      result.push(part.value);
    } else if (part.removed) {
      result.push(part.value);
    } else {
      result.push(part.value);
    }
  }
  return result.join('');
}

function mergeTitle(serverTitle: string, incomingTitle: string, serverChanged: boolean, incomingChanged: boolean): string {
  if (!incomingChanged) return serverTitle;
  if (!serverChanged) return incomingTitle;
  if (incomingTitle === serverTitle) return serverTitle;
  return serverTitle;
}

router.put('/docs/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  const { title, content, markdown, parentId, sortOrder, permission, allowedUsers, saveVersion, versionMessage, baseVersion } = req.body;

  const existing = dbQueries.getDocument(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Document not found' });
  if (!canUserAccess(existing, userId)) return res.status(403).json({ error: 'Access denied' });

  let finalTitle = title !== undefined ? title : existing.title;
  let finalContent = content !== undefined ? content : existing.content;
  let finalMarkdown = markdown !== undefined ? markdown : existing.markdown;

  const hasContentChange = title !== undefined || content !== undefined || markdown !== undefined;
  const hasVersionConflict = typeof baseVersion === 'number' && baseVersion < existing.version;

  if (hasContentChange && hasVersionConflict) {
    if (markdown !== undefined) {
      finalMarkdown = mergeText(existing.markdown, markdown);
    }
    if (title !== undefined) {
      finalTitle = mergeTitle(existing.title, title, true, true);
    }
  }

  if (saveVersion) {
    dbQueries.createVersion(
      existing.id,
      finalTitle,
      finalContent,
      finalMarkdown,
      userId,
      versionMessage
    );
  }

  const updates: any = { updatedBy: userId };
  if (title !== undefined) updates.title = finalTitle;
  if (content !== undefined) updates.content = finalContent;
  if (markdown !== undefined) updates.markdown = finalMarkdown;
  if (parentId !== undefined) updates.parentId = parentId || null;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (permission !== undefined) updates.permission = permission;
  if (allowedUsers !== undefined) updates.allowedUsers = allowedUsers;

  const updated = dbQueries.updateDocument(req.params.id, updates);
  res.json(updated);
});

router.put('/docs/:id/move', (req, res) => {
  const userId = getCurrentUserId(req);
  const { parentId, sortOrder } = req.body;

  const existing = dbQueries.getDocument(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Document not found' });

  if (parentId !== undefined && parentId !== null) {
    const isDescendant = dbQueries.isDescendantOf(parentId, existing.id);
    if (isDescendant) {
      return res.status(400).json({ error: '不能将文档移动到其子文件夹下' });
    }
    const targetDoc = dbQueries.getDocument(parentId);
    if (!targetDoc) return res.status(404).json({ error: '目标文件夹不存在' });
    if (targetDoc.type !== 'folder') return res.status(400).json({ error: '只能移动到文件夹中' });
  }

  const updates: any = { updatedBy: userId };
  if (parentId !== undefined) updates.parentId = parentId || null;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  const updated = dbQueries.updateDocument(req.params.id, updates);
  res.json(updated);
});

router.delete('/docs/:id', (req, res) => {
  const success = dbQueries.deleteDocument(req.params.id);
  if (!success) return res.status(404).json({ error: 'Document not found' });
  res.json({ success: true });
});

router.get('/docs/:id/versions', (req, res) => {
  const userId = getCurrentUserId(req);
  const doc = dbQueries.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!canUserAccess(doc, userId)) return res.status(403).json({ error: 'Access denied' });
  const versions = dbQueries.getVersionsByDoc(req.params.id);
  res.json(versions);
});

router.get('/versions/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  const version = dbQueries.getVersion(req.params.id);
  if (!version) return res.status(404).json({ error: 'Version not found' });

  const doc = dbQueries.getDocument(version.docId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!canUserAccess(doc, userId)) return res.status(403).json({ error: 'Access denied' });

  res.json(version);
});

router.get('/docs/:id/diff', (req, res) => {
  const userId = getCurrentUserId(req);
  const { fromVersion, toVersion } = req.query as { fromVersion: string; toVersion?: string };

  const doc = dbQueries.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!canUserAccess(doc, userId)) return res.status(403).json({ error: 'Access denied' });

  const fromV = dbQueries.getVersion(fromVersion);
  if (!fromV) return res.status(404).json({ error: 'fromVersion not found' });
  if (fromV.docId !== doc.id) return res.status(400).json({ error: 'fromVersion does not belong to this document' });

  let toContent: string;
  let toTitle: string;
  if (toVersion) {
    const toV = dbQueries.getVersion(toVersion);
    if (!toV) return res.status(404).json({ error: 'toVersion not found' });
    if (toV.docId !== doc.id) return res.status(400).json({ error: 'toVersion does not belong to this document' });
    toContent = toV.markdown;
    toTitle = toV.title;
  } else {
    toContent = doc.markdown;
    toTitle = doc.title;
  }

  const diff = Diff.diffLines(fromV.markdown, toContent);
  const titleDiff = Diff.diffChars(fromV.title, toTitle);
  res.json({ titleDiff, contentDiff: diff });
});

router.post('/docs/:id/rollback', (req, res) => {
  const userId = getCurrentUserId(req);
  const { versionId } = req.body;

  const doc = dbQueries.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!canUserAccess(doc, userId)) return res.status(403).json({ error: 'Access denied' });

  const version = dbQueries.getVersion(versionId);
  if (!version) return res.status(404).json({ error: 'Version not found' });
  if (version.docId !== doc.id) return res.status(400).json({ error: 'Version does not belong to this document' });

  dbQueries.createVersion(doc.id, doc.title, doc.content, doc.markdown, userId, '回滚前自动保存');

  const updated = dbQueries.updateDocument(req.params.id, {
    title: version.title,
    content: version.content,
    markdown: version.markdown,
    updatedBy: userId,
  });
  res.json(updated);
});

router.get('/search', (req, res) => {
  const userId = getCurrentUserId(req);
  const { q, spaceId } = req.query as { q: string; spaceId?: string };
  if (!q) return res.json([]);
  const results = dbQueries.searchDocuments(q, spaceId);
  const filtered = results
    .filter(doc => canUserAccess(doc, userId))
    .map(doc => stripPrivateContent(doc, userId));
  res.json(filtered);
});

export default router;
