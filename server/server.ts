import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameEngine } from '../src/core/GameEngine';
import { GridSize, GameState, Point3D } from '../src/core/types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://192.168.0.209:3000"],
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

  socket.on('get-room-info', ({ roomId }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('room-info-error', 'Room not found');
      return;
    }
    
    if (room.players.size >= 2) {
      socket.emit('room-info-error', 'Room is full');
      return;
    }
    
    const player1 = Array.from(room.players.values())[0];
    socket.emit('room-info', {
      roomId,
      player1Name: player1?.name || 'Player 1',
      gridSize: room.gridSize,
      playersCount: room.players.size
    });
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
      // IMPORTANT: Send room-joined to Player 2 FIRST so they get their player ID
      const players = Array.from(room.players.values());
      const player1Name = players[0]?.name || 'Player 1';
      
      socket.emit('room-joined', { 
        roomId, 
        playerId, 
        gameState: null,
        player1Name: player1Name
      });
      
      // Now start the game
      room.gameEngine = new GameEngine(room.gridSize, 'online');
      room.started = true;
      
      const gameState = room.gameEngine.getState();
      
      // Update player names in the engine
      gameState.players[0].name = players[0].name;
      gameState.players[1].name = players[1].name;
      
      // Create a deep copy for clients with socket IDs for UI identification
      const stateForClients = JSON.parse(JSON.stringify(gameState));
      stateForClients.players[0].id = players[0].id;
      stateForClients.players[1].id = players[1].id;
      // Current player uses socket ID for client-side turn validation
      stateForClients.currentPlayer = { ...gameState.currentPlayer, id: players[0].id };
      
      console.log(`🎯 GAME STARTED - INITIAL STATE DEBUG 🎯`);
      console.log('=== GAME START DEBUG INFO ===');
      console.log('Engine current player:', JSON.stringify(gameState.currentPlayer, null, 2));
      console.log('State for clients current player:', JSON.stringify(stateForClients.currentPlayer, null, 2));
      console.log('Players mapping:');
      players.forEach((p, idx) => {
        console.log(`  Player ${idx}: ${p.name} (socket: ${p.socketId})`);
      });
      console.log('State for clients players:', JSON.stringify(stateForClients.players, null, 2));
      console.log('Turn:', stateForClients.turn);
      console.log('=== END GAME START DEBUG ===');
      
      // Small delay to ensure room-joined is processed before game-started
      setTimeout(() => {
        io.to(roomId).emit('game-started', stateForClients);
        console.log(`Game started in room ${roomId}`);
      }, 100);
    } else {
      const players = Array.from(room.players.values());
      const player1Name = players[0]?.name || 'Player 1';
      
      socket.emit('room-joined', { 
        roomId, 
        playerId, 
        gameState: null,
        player1Name: player1Name
      });
      socket.to(roomId).emit('player-joined', { playerId, playerName });
    }
  });

  socket.on('make-move', ({ roomId, playerId, start, end }: { roomId: string; playerId: string; start: Point3D; end: Point3D }) => {
    console.log(`Move received from ${socket.id} in room ${roomId}:`, { start, end });
    const room = rooms.get(roomId);
    
    if (!room || !room.gameEngine) {
      console.log('Error: Game not found');
      socket.emit('error', 'Game not found');
      return;
    }
    
    const gameState = room.gameEngine.getState();
    
    // Get player info
    const players = Array.from(room.players.values());
    const playerIndex = players.findIndex(p => p.socketId === socket.id);
    
    if (playerIndex === -1) {
      console.log('Error: Player not in room');
      socket.emit('error', 'Player not in room');
      return;
    }
    
    // The game engine uses 'player1' and 'player2' internally
    const gamePlayerId = playerIndex === 0 ? 'player1' : 'player2';
    
    console.log(`Player ${gamePlayerId} (socket: ${socket.id}) attempting move. Current player in engine: ${gameState.currentPlayer.id}`);
    
    // Check if it's this player's turn (compare game engine IDs)
    if (gameState.currentPlayer.id !== gamePlayerId) {
      console.log('🚨 SERVER: NOT PLAYER TURN 🚨');
      console.log('=== SERVER SIDE DEBUG INFO ===');
      console.log('Socket ID:', socket.id);
      console.log('Player Index:', playerIndex);
      console.log('Game Player ID (derived):', gamePlayerId);
      console.log('Game Player ID type:', typeof gamePlayerId);
      console.log('Current Player ID from engine:', gameState.currentPlayer.id);
      console.log('Current Player ID type:', typeof gameState.currentPlayer.id);
      console.log('Are they equal?', gameState.currentPlayer.id === gamePlayerId);
      console.log('Full current player from engine:', JSON.stringify(gameState.currentPlayer, null, 2));
      console.log('All players from engine:', JSON.stringify(gameState.players, null, 2));
      console.log('Engine turn:', gameState.turn);
      console.log('Room players mapping:');
      players.forEach((p, idx) => {
        console.log(`  Player ${idx}: ${p.name} (socket: ${p.socketId})`);
      });
      console.log('=== END SERVER DEBUG ===');
      socket.emit('error', 'Not your turn');
      return;
    }
    
    const success = room.gameEngine.makeMove(start, end);
    console.log(`Move result: ${success ? 'success' : 'failed'}`);
    
    if (success) {
      const updatedState = room.gameEngine.getState();
      
      // Create a deep copy for clients with socket IDs for UI identification
      const stateForClients = JSON.parse(JSON.stringify(updatedState));
      stateForClients.players[0].id = players[0].id;
      stateForClients.players[1].id = players[1].id;
      // Map current player to socket ID
      stateForClients.currentPlayer = updatedState.currentPlayer.id === 'player1' 
        ? { ...updatedState.currentPlayer, id: players[0].id }
        : { ...updatedState.currentPlayer, id: players[1].id };
      
      console.log(`Broadcasting game-state-update to room ${roomId}. Turn: ${updatedState.turn}, Current player: ${updatedState.currentPlayer.id}`);
      io.to(roomId).emit('game-state-update', stateForClients);
      
      if (updatedState.winner) {
        console.log(`Game ended in room ${roomId}. Winner: ${updatedState.winner.name}`);
        rooms.delete(roomId);
      }
    } else {
      console.log('Error: Invalid move');
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

const PORT = process.env.PORT || 3002;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://192.168.0.209:${PORT}`);
}).on('error', (error: any) => {
  console.error('Failed to start server:', error.message);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please:`);
    console.error('1. Kill the process using that port, or');
    console.error('2. Set a different PORT environment variable');
  }
  
  process.exit(1); // Exit with non-zero code to indicate failure
});