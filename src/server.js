require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Result = require('./models/Result');
const { calculateResult } = require('./gameLogic');

const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN.split(',') }));
app.use(express.json());

let dbReady = false;

app.get('/', (_req, res) => res.json({ ok: true, name: 'xo-backend' }));

// Leaderboard: wins per player name
app.get('/api/leaderboard', async (_req, res) => {
  if (!dbReady) return res.json([]);
  const rows = await Result.aggregate([
    { $match: { winner: { $in: ['X', 'O'] } } },
    { $project: { name: { $cond: [{ $eq: ['$winner', 'X'] }, '$playerX', '$playerO'] } } },
    { $group: { _id: '$name', wins: { $sum: 1 } } },
    { $sort: { wins: -1 } },
    { $limit: 10 },
  ]);
  res.json(rows.map((r) => ({ name: r._id, wins: r.wins })));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGIN === '*' ? true : ORIGIN.split(',') } });

// In-memory rooms: code -> { board, turn, players: {X: {id,name}, O: {...}}, over }
const rooms = new Map();

function newRoom() {
  return { board: Array(9).fill(null), turn: 'X', players: { X: null, O: null }, over: false, line: [], winner: null };
}

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function publicState(code) {
  const r = rooms.get(code);
  return {
    code,
    board: r.board,
    turn: r.turn,
    over: r.over,
    winner: r.winner,
    line: r.line,
    players: { X: r.players.X?.name || null, O: r.players.O?.name || null },
  };
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ name }, cb) => {
    const code = makeCode();
    const room = newRoom();
    room.players.X = { id: socket.id, name: String(name || 'Player X').slice(0, 20) };
    rooms.set(code, room);
    socket.join(code);
    socket.data = { code, symbol: 'X' };
    cb?.({ ok: true, symbol: 'X', state: publicState(code) });
  });

  socket.on('join_room', ({ code, name }, cb) => {
    code = String(code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: 'Room not found' });
    if (room.players.O) return cb?.({ ok: false, error: 'Room is full' });
    room.players.O = { id: socket.id, name: String(name || 'Player O').slice(0, 20) };
    socket.join(code);
    socket.data = { code, symbol: 'O' };
    cb?.({ ok: true, symbol: 'O', state: publicState(code) });
    io.to(code).emit('state', publicState(code));
  });

  socket.on('move', ({ index }) => {
    const { code, symbol } = socket.data || {};
    const room = rooms.get(code);
    if (!room || room.over || !room.players.X || !room.players.O) return;
    if (room.turn !== symbol) return;
    if (!Number.isInteger(index) || index < 0 || index > 8 || room.board[index]) return;

    room.board[index] = symbol;
    const result = calculateResult(room.board);
    if (result) {
      room.over = true;
      room.winner = result.winner;
      room.line = result.line;
      if (dbReady) {
        Result.create({
          roomCode: code,
          playerX: room.players.X.name,
          playerO: room.players.O.name,
          winner: result.winner,
        }).catch((e) => console.error('save failed', e.message));
      }
    } else {
      room.turn = symbol === 'X' ? 'O' : 'X';
    }
    io.to(code).emit('state', publicState(code));
  });

  socket.on('rematch', () => {
    const { code } = socket.data || {};
    const room = rooms.get(code);
    if (!room || !room.over) return;
    // loser (or X on draw) starts next
    room.turn = room.winner === 'X' ? 'O' : 'X';
    room.board = Array(9).fill(null);
    room.over = false;
    room.winner = null;
    room.line = [];
    io.to(code).emit('state', publicState(code));
  });

  socket.on('disconnect', () => {
    const { code, symbol } = socket.data || {};
    const room = rooms.get(code);
    if (!room) return;
    room.players[symbol] = null;
    io.to(code).emit('opponent_left');
    if (!room.players.X && !room.players.O) rooms.delete(code);
  });
});

async function start() {
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      dbReady = true;
      console.log('MongoDB connected');
    } catch (e) {
      console.error('MongoDB connection failed, continuing without stats:', e.message);
    }
  } else {
    console.log('MONGO_URI not set, running without leaderboard');
  }
  server.listen(PORT, () => console.log(`Server listening on :${PORT}`));
}

start();
