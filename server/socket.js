import { Server } from 'socket.io';
import { config } from './config.js';
import { get, run, nowIso } from './db/index.js';
import { SESSION_COOKIE, userFromToken } from './middleware/auth.js';
import { setIo } from './services/notify.js';

function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function attachSocket(server) {
  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: config.clientOrigin, credentials: true },
    maxHttpBufferSize: 16 * 1024,
  });
  setIo(io);

  io.use((socket, next) => {
    const user = userFromToken(readCookie(socket.handshake.headers.cookie, SESSION_COOKIE));
    if (!user || user.status === 'suspended') return next(new Error('UNAUTHENTICATED'));
    socket.data.userId = user.id;
    next();
  });

  io.on('connection', (socket) => {
    const me = socket.data.userId;
    socket.join(`user:${me}`);
    const peers = new Map();
    let windowStart = Date.now();
    let count = 0;

    socket.on('typing', (payload) => {
      try {
        const now = Date.now();
        if (now - windowStart > 1000) {
          windowStart = now;
          count = 0;
        }
        if (++count > 20) return;
        const conversationId = Number(payload?.conversationId);
        if (!Number.isInteger(conversationId)) return;
        if (!peers.has(conversationId)) {
          const cv = get('SELECT user_a_id, user_b_id FROM conversations WHERE id = ?', conversationId);
          if (!cv || (cv.user_a_id !== me && cv.user_b_id !== me)) return;
          peers.set(conversationId, cv.user_a_id === me ? cv.user_b_id : cv.user_a_id);
        }
        io.to(`user:${peers.get(conversationId)}`).emit('typing', {
          conversationId,
          userId: me,
          isTyping: !!payload.isTyping,
        });
      } catch {
        // Ignore malformed client events.
      }
    });

    socket.on('disconnect', () => {
      run('UPDATE users SET last_seen_at = ? WHERE id = ?', nowIso(), me);
    });
  });

  return io;
}
