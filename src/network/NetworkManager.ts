import { io, Socket } from 'socket.io-client';
import { GameMove, GameState, GridSize, Point3D } from '../core/types';

export interface RoomInfo {
  roomId: string;
  players: string[];
  gridSize: GridSize;
}

export class NetworkManager {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private playerId: string | null = null;
  private callbacks: Map<string, Function> = new Map();

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.socket = io(serverUrl, {
      autoConnect: false
    });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.emit('disconnected');
    });

    this.socket.on('room-created', (data: { roomId: string, playerId: string }) => {
      this.roomId = data.roomId;
      this.playerId = data.playerId;
      this.emit('room-created', data);
    });

    this.socket.on('room-joined', (data: { roomId: string, playerId: string, gameState: GameState }) => {
      this.roomId = data.roomId;
      this.playerId = data.playerId;
      this.emit('room-joined', data);
    });

    this.socket.on('player-joined', (data: { playerId: string, playerName: string }) => {
      this.emit('player-joined', data);
    });

    this.socket.on('player-left', (data: { playerId: string }) => {
      this.emit('player-left', data);
    });

    this.socket.on('game-started', (gameState: GameState) => {
      this.emit('game-started', gameState);
    });

    this.socket.on('move-made', (move: GameMove) => {
      this.emit('move-made', move);
    });

    this.socket.on('game-state-update', (gameState: GameState) => {
      this.emit('game-state-update', gameState);
    });

    this.socket.on('error', (error: string) => {
      console.error('Server error:', error);
      this.emit('error', error);
    });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject('Socket not initialized');
        return;
      }

      this.socket.once('connect', () => {
        resolve();
      });

      this.socket.once('connect_error', (error) => {
        reject(error);
      });

      this.socket.connect();
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  public createRoom(playerName: string, gridSize: GridSize): void {
    if (!this.socket) return;
    
    this.socket.emit('create-room', {
      playerName,
      gridSize
    });
  }

  public joinRoom(roomId: string, playerName: string): void {
    if (!this.socket) return;
    
    this.socket.emit('join-room', {
      roomId,
      playerName
    });
  }

  public makeMove(start: Point3D, end: Point3D): void {
    if (!this.socket || !this.roomId) return;
    
    this.socket.emit('make-move', {
      roomId: this.roomId,
      playerId: this.playerId,
      start,
      end
    });
  }

  public getRooms(): Promise<RoomInfo[]> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve([]);
        return;
      }

      this.socket.once('rooms-list', (rooms: RoomInfo[]) => {
        resolve(rooms);
      });

      this.socket.emit('get-rooms');
    });
  }

  public on(event: string, callback: Function): void {
    this.callbacks.set(event, callback);
  }

  public off(event: string): void {
    this.callbacks.delete(event);
  }

  private emit(event: string, data?: any): void {
    const callback = this.callbacks.get(event);
    if (callback) {
      callback(data);
    }
  }

  public getRoomId(): string | null {
    return this.roomId;
  }

  public getPlayerId(): string | null {
    return this.playerId;
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
}