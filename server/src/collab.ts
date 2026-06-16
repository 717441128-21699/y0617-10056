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

export function setupSocketIO(io: Server) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.headers['x-user-id'] as string || 'user-1';
    const userName = socket.handshake.headers['x-user-name'] as string || '用户';
    const userAvatar = socket.handshake.headers['x-user-avatar'] as string || '#6B7280';

    socket.on('join-doc', ({ docId }: { docId: string }) => {
      socket.join(`doc:${docId}`);

      if (!onlineUsers.has(docId)) {
        onlineUsers.set(docId, new Map());
      }
      onlineUsers.get(docId)!.set(socket.id, {
        id: userId,
        name: decodeURIComponent(userName),
        avatar: decodeURIComponent(userAvatar),
        socketId: socket.id,
      });

      const users = Array.from(onlineUsers.get(docId)!.values());
      io.to(`doc:${docId}`).emit('online-users', users);
    });

    socket.on('leave-doc', ({ docId }: { docId: string }) => {
      socket.leave(`doc:${docId}`);

      if (onlineUsers.has(docId)) {
        onlineUsers.get(docId)!.delete(socket.id);
        const users = Array.from(onlineUsers.get(docId)!.values());
        io.to(`doc:${docId}`).emit('online-users', users);
      }
    });

    socket.on('doc-updated', ({ docId }: { docId: string }) => {
      const doc = dbQueries.getDocument(docId);
      if (doc) {
        socket.to(`doc:${docId}`).emit('doc-changed', {
          docId,
          title: doc.title,
          content: doc.content,
          markdown: doc.markdown,
        });
      }
    });

    socket.on('doc-edit', ({ docId, title, content, markdown }: { docId: string; title: string; content: string; markdown: string }) => {
      socket.to(`doc:${docId}`).emit('doc-edit', {
        docId,
        title,
        content,
        markdown,
        from: socket.id,
      });
    });

    socket.on('disconnect', () => {
      onlineUsers.forEach((users, docId) => {
        if (users.has(socket.id)) {
          users.delete(socket.id);
          const remaining = Array.from(users.values());
          io.to(`doc:${docId}`).emit('online-users', remaining);
        }
      });
    });
  });
}

export function setupYjsWSS(wss: WebSocketServer) {
  wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
    setupWSConnection(conn, req);
  });
}

export { setupWSConnection, getDoc };
