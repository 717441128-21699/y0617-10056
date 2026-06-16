import { Router, Request, Response } from 'express';
import * as Diff from 'diff';
import { dbQueries } from './db.js';
import type { PermissionLevel, DocPermission, DocType } from './types.js';

const router = Router();

const getCurrentUserId = (req: Request): string => {
  return (req.headers['x-user-id'] as string) || 'user-1';
};

router.get('/users', (_req, res) => {
  res.json(dbQueries.getUsers());
});

router.get('/spaces', (_req, res) => {
  res.json(dbQueries.getSpaces());
});

router.post('/spaces', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const space = dbQueries.createSpace(name, description || '');
  res.json(space);
});

router.get('/spaces/:spaceId/docs', (req, res) => {
  const { spaceId } = req.params;
  res.json(dbQueries.getDocumentsBySpace(spaceId));
});

router.get('/docs/:id', (req, res) => {
  const doc = dbQueries.getDocument(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json(doc);
});

router.post('/docs', (req, res) => {
  const userId = getCurrentUserId(req);
  const { spaceId, parentId, title, type, permission, allowedUsers } = req.body;

  if (!spaceId || !title || !type) {
    return res.status(400).json({ error: 'spaceId, title, and type are required' });
  }

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

router.put('/docs/:id', (req, res) => {
  const userId = getCurrentUserId(req);
  const { title, content, markdown, parentId, sortOrder, permission, allowedUsers, saveVersion, versionMessage } = req.body;

  const existing = dbQueries.getDocument(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const updates: any = { updatedBy: userId };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (markdown !== undefined) updates.markdown = markdown;
  if (parentId !== undefined) updates.parentId = parentId;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (permission !== undefined) updates.permission = permission;
  if (allowedUsers !== undefined) updates.allowedUsers = allowedUsers;

  if (saveVersion) {
    dbQueries.createVersion(
      existing.id,
      existing.title,
      existing.content,
      existing.markdown,
      userId,
      versionMessage
    );
  }

  const updated = dbQueries.updateDocument(req.params.id, updates);
  res.json(updated);
});

router.put('/docs/:id/move', (req, res) => {
  const userId = getCurrentUserId(req);
  const { parentId, sortOrder, spaceId } = req.body;

  const existing = dbQueries.getDocument(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const updates: any = { updatedBy: userId };
  if (parentId !== undefined) updates.parentId = parentId;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (spaceId !== undefined) updates.spaceId = spaceId;

  const updated = dbQueries.updateDocument(req.params.id, updates);
  res.json(updated);
});

router.delete('/docs/:id', (req, res) => {
  const success = dbQueries.deleteDocument(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json({ success: true });
});

router.get('/docs/:id/versions', (req, res) => {
  const versions = dbQueries.getVersionsByDoc(req.params.id);
  res.json(versions);
});

router.get('/versions/:id', (req, res) => {
  const version = dbQueries.getVersion(req.params.id);
  if (!version) {
    return res.status(404).json({ error: 'Version not found' });
  }
  res.json(version);
});

router.get('/docs/:id/diff', (req, res) => {
  const { fromVersion, toVersion } = req.query as { fromVersion: string; toVersion?: string };

  const doc = dbQueries.getDocument(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const fromV = dbQueries.getVersion(fromVersion);
  if (!fromV) {
    return res.status(404).json({ error: 'fromVersion not found' });
  }

  let toContent: string;
  let toTitle: string;
  if (toVersion) {
    const toV = dbQueries.getVersion(toVersion);
    if (!toV) {
      return res.status(404).json({ error: 'toVersion not found' });
    }
    toContent = toV.markdown;
    toTitle = toV.title;
  } else {
    toContent = doc.markdown;
    toTitle = doc.title;
  }

  const diff = Diff.diffLines(fromV.markdown, toContent);
  const titleDiff = Diff.diffChars(fromV.title, toTitle);

  res.json({
    titleDiff,
    contentDiff: diff,
  });
});

router.post('/docs/:id/rollback', (req, res) => {
  const userId = getCurrentUserId(req);
  const { versionId } = req.body;

  const doc = dbQueries.getDocument(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const version = dbQueries.getVersion(versionId);
  if (!version) {
    return res.status(404).json({ error: 'Version not found' });
  }

  dbQueries.createVersion(
    doc.id,
    doc.title,
    doc.content,
    doc.markdown,
    userId,
    '回滚前自动保存'
  );

  const updated = dbQueries.updateDocument(req.params.id, {
    title: version.title,
    content: version.content,
    markdown: version.markdown,
    updatedBy: userId,
  });

  res.json(updated);
});

router.get('/search', (req, res) => {
  const { q, spaceId } = req.query as { q: string; spaceId?: string };
  if (!q) {
    return res.json([]);
  }
  const results = dbQueries.searchDocuments(q, spaceId);
  res.json(results);
});

export default router;
