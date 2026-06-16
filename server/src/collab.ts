import { Server } from 'socket.io';
import { IncomingMessage } from 'http';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { WebSocketServer, WebSocket } from 'ws';
import { dbQueries } from './db.js';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;

const docs = new Map<string, { doc: Y.Doc; conns: Set<WebSocket> }>();

const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2;

function getDoc(name: string) {
  let docData = docs.get(name);
  if (!docData) {
    const ydoc = new Y.Doc();
    ydoc.gc = true;
    docData = { doc: ydoc, conns: new Set() };
    docs.set(name, docData);
  }
  return docData;
}

function send(doc: Y.Doc, conn: WebSocket, m: encoding.Encoder) {
  if ((conn as any).readyState !== wsReadyStateConnecting && (conn as any).readyState !== wsReadyStateOpen) {
    closeConn(conn);
  }
  try {
    conn.send(encoding.toUint8Array(m));
  } catch (e) {
    closeConn(conn);
  }
}

function closeConn(conn: WebSocket) {
  if ((conn as any)._docName !== undefined) {
    const docData = docs.get((conn as any)._docName as string);
    if (docData) {
      docData.conns.delete(conn);
      if (docData.conns.size === 0) {
        docs.delete((conn as any)._docName as string);
        docData.doc.destroy();
      }
    }
  }
  conn.close();
}

function setupWSConnection(conn: WebSocket, req: IncomingMessage | undefined, docName?: string) {
  docName = docName || req?.url?.slice(1).split('?')[0] || 'default';
  (conn as any).binaryType = 'arraybuffer';
  (conn as any)._docName = docName;

  const docData = getDoc(docName);
  const ydoc = docData.doc;
  const awareness = new awarenessProtocol.Awareness(ydoc);

  awareness.setLocalState(null);
  docData.conns.add(conn);

  conn.on('message', (message: any) => {
    try {
      const encoder = encoding.createEncoder();
      const decoder = decoding.createDecoder(message instanceof ArrayBuffer ? new Uint8Array(message) : message);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case messageSync:
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, ydoc, conn);
          if (encoding.length(encoder) > 1) {
            send(ydoc, conn, encoder);
          }
          break;
        case messageAwareness: {
          encoding.writeVarUint(encoder, messageAwareness);
          awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), conn);
          const changed = awarenessProtocol.removeAwarenessStates(awareness, [docData.conns.size + Date.now()], conn);
          awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()), encoder);
          const buff = encoding.toUint8Array(encoder);
          docData.conns.forEach(c => {
            if (c !== conn && c.readyState === wsReadyStateOpen) {
              c.send(buff);
            }
          });
          break;
        }
        case messageAuth: {
          break;
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  conn.on('close', () => {
    closeConn(conn);
    awarenessProtocol.removeAwarenessStates(awareness, [docData.conns.size + 1], 'client disconnected');
  });

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, ydoc);
  send(ydoc, conn, encoder);

  if (awareness.getStates().size > 0) {
    const awarenessStates = awareness.getStates();
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, messageAwareness);
    encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()), conn));
    send(ydoc, conn, enc);
  }
}

interface OnlineUser {
  id: string;
  name: string;
  avatar: string;
  socketId: string;
}

export const onlineUsers = new Map<string, Map<string, OnlineUser>>();
const socketJoinedDocs = new Map<string, Set<string>>();

function canUserAccess(docId: string, userId: string): boolean {
  const doc = dbQueries.getDocument(docId);
  if (!doc) return false;
  if (doc.permission === 'public') return true;
  if (doc.permission === 'team') return true;
  if (doc.createdBy === userId) return true;
  if (doc.allowedUsers && doc.allowedUsers.some(u => u.userId === userId)) return true;
  return false;
}

function kickUnauthorizedSocketsFromRoom(io: Server, docId: string) {
  const room = io.sockets.adapter.rooms.get(`doc:${docId}`);
  if (!room) return;
  room.forEach(socketId => {
    const s = io.sockets.sockets.get(socketId);
    if (!s) return;
    const uid = (s as any).userId as string;
    if (!canUserAccess(docId, uid)) {
      s.leave(`doc:${docId}`);
      s.emit('access-denied', { docId });
      onlineUsers.get(docId)?.delete(socketId);
      socketJoinedDocs.get(socketId)?.delete(docId);
    }
  });
  const users = onlineUsers.has(docId) ? Array.from(onlineUsers.get(docId)!.values()) : [];
  io.to(`doc:${docId}`).emit('online-users', users);
}

export function setupSocketIO(io: Server) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.headers['x-user-id'] as string || 'user-1';
    const userName = socket.handshake.headers['x-user-name'] as string || '用户';
    const userAvatar = socket.handshake.headers['x-user-avatar'] as string || '#6B7280';
    (socket as any).userId = userId;

    socketJoinedDocs.set(socket.id, new Set());

    socket.on('join-doc', ({ docId }: { docId: string }) => {
      if (!canUserAccess(docId, userId)) {
        socket.emit('access-denied', { docId });
        return;
      }
      socket.join(`doc:${docId}`);
      socketJoinedDocs.get(socket.id)!.add(docId);

      if (!onlineUsers.has(docId)) {
        onlineUsers.set(docId, new Map());
      }
      onlineUsers.get(docId)!.set(socket.id, {
        id: userId,
        name: decodeURIComponent(userName),
        avatar: decodeURIComponent(userAvatar),
        socketId: socket.id,
      });

      kickUnauthorizedSocketsFromRoom(io, docId);
    });

    socket.on('leave-doc', ({ docId }: { docId: string }) => {
      socket.leave(`doc:${docId}`);
      socketJoinedDocs.get(socket.id)?.delete(docId);

      if (onlineUsers.has(docId)) {
        onlineUsers.get(docId)!.delete(socket.id);
        const users = Array.from(onlineUsers.get(docId)!.values());
        io.to(`doc:${docId}`).emit('online-users', users);
      }
    });

    socket.on('doc-updated', ({ docId }: { docId: string }) => {
      if (!canUserAccess(docId, userId)) return;
      kickUnauthorizedSocketsFromRoom(io, docId);
      const doc = dbQueries.getDocument(docId);
      if (doc && canUserAccess(docId, (socket as any).userId)) {
        socket.to(`doc:${docId}`).emit('doc-changed', {
          docId,
          title: doc.title,
          content: doc.content,
          markdown: doc.markdown,
        });
      }
    });

    socket.on('doc-edit', ({ docId, title, content, markdown }: { docId: string; title: string; content: string; markdown: string }) => {
      if (!canUserAccess(docId, userId)) return;
      kickUnauthorizedSocketsFromRoom(io, docId);
      socket.to(`doc:${docId}`).emit('doc-edit', {
        docId,
        title,
        content,
        markdown,
        from: socket.id,
      });
    });

    socket.on('disconnect', () => {
      const docs = socketJoinedDocs.get(socket.id);
      if (docs) {
        docs.forEach(docId => {
          if (onlineUsers.has(docId)) {
            onlineUsers.get(docId)!.delete(socket.id);
            const remaining = Array.from(onlineUsers.get(docId)!.values());
            io.to(`doc:${docId}`).emit('online-users', remaining);
          }
        });
      }
      socketJoinedDocs.delete(socket.id);
    });
  });
}

export function setupYjsWSS(wss: WebSocketServer) {
  wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
    setupWSConnection(conn, req);
  });
}

export { setupWSConnection, getDoc };
