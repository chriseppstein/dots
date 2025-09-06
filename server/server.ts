import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameEngine } from '../src/core/GameEngine';
import { GridSize, GameState, Point3D } from '../src/core/types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

interface Room {
  id: string;
  players: Map<string, { id: string; name: string; socketId: string }>;
  gameEngine: GameEngine | null;
  gridSize: GridSize;
  started: boolean;
}

const rooms = new Map<string, Room>();

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', ({ playerName, gridSize }) => {
    const roomId = generateRoomId();
    const playerId = socket.id;
    
    const room: Room = {
      id: roomId,
      players: new Map([[playerId, { id: playerId, name: playerName, socketId: socket.id }]]),
      gameEngine: null,
      gridSize,
      started: false
    };
    
    rooms.set(roomId, room);
    socket.join(roomId);
    
    socket.emit('room-created', { roomId, playerId });
    console.log(`Room ${roomId} created by ${playerName}`);
  });

  socket.on('join-room', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    if (room.players.size >= 2) {
      socket.emit('error', 'Room is full');
      return;
    }
    
    const playerId = socket.id;
    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id });
    socket.join(roomId);
    
    if (room.players.size === 2 && !room.started) {
      room.gameEngine = new GameEngine(room.gridSize, 'online');
      room.started = true;
      
      const players = Array.from(room.players.values());
      const gameState = room.gameEngine.getState();
      gameState.players[0].name = players[0].name;
      gameState.players[0].id = players[0].id;
      gameState.players[1].name = players[1].name;
      gameState.players[1].id = players[1].id;
      
      io.to(roomId).emit('game-started', gameState);
      console.log(`Game started in room ${roomId}`);
    } else {
      socket.emit('room-joined', { roomId, playerId, gameState: null });
      socket.to(roomId).emit('player-joined', { playerId, playerName });
    }
  });

  socket.on('make-move', ({ roomId, playerId, start, end }: { roomId: string; playerId: string; start: Point3D; end: Point3D }) => {
    const room = rooms.get(roomId);
    
    if (!room || !room.gameEngine) {
      socket.emit('error', 'Game not found');
      return;
    }
    
    const gameState = room.gameEngine.getState();
    
    if (gameState.currentPlayer.id !== playerId) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    const success = room.gameEngine.makeMove(start, end);
    
    if (success) {
      const updatedState = room.gameEngine.getState();
      io.to(roomId).emit('game-state-update', updatedState);
      
      if (updatedState.winner) {
        console.log(`Game ended in room ${roomId}. Winner: ${updatedState.winner.name}`);
        rooms.delete(roomId);
      }
    } else {
      socket.emit('error', 'Invalid move');
    }
  });

  socket.on('get-rooms', () => {
    const roomsList = Array.from(rooms.values())
      .filter(room => !room.started && room.players.size < 2)
      .map(room => ({
        roomId: room.id,
        players: Array.from(room.players.values()).map(p => p.name),
        gridSize: room.gridSize
      }));
    
    socket.emit('rooms-list', roomsList);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    for (const [roomId, room] of rooms) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        
        if (room.players.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          io.to(roomId).emit('player-left', { playerId: socket.id });
        }
        
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});