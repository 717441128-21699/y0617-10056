import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import { initDb } from './db.js';
import router from './routes.js';
import { setupSocketIO, setupYjsWSS } from './collab.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initDb();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api', router);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
  },
});
setupSocketIO(io);

const wss = new WebSocketServer({ noServer: true });
setupYjsWSS(wss);

server.on('upgrade', (request, socket, head) => {
  const { url = '' } = request;
  if (url.startsWith('/yjs/')) {
    wss.handleUpgrade(request, socket as any, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Yjs WebSocket running on ws://localhost:${PORT}/yjs/`);
});
