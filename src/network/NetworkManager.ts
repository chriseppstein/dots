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

  constructor(serverUrl: string = 'http://localhost:3002') {
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
      console.log('🔗 NetworkManager: room-joined received, setting playerId:', data.playerId);
      this.roomId = data.roomId;
      this.playerId = data.playerId;
      console.log('🔗 NetworkManager: playerId set to:', this.playerId);
      this.emit('room-joined', data);
    });

    this.socket.on('player-joined', (data: { playerId: string, playerName: string }) => {
      this.emit('player-joined', data);
    });

    this.socket.on('player-left', (data: { playerId: string }) => {
      this.emit('player-left', data);
    });

    this.socket.on('game-started', (gameState: GameState) => {
      console.log('🎯 NetworkManager: game-started received');
      
      // CRITICAL FIX: If playerId is null, extract it from the gameState
      // This handles cases where room-joined event wasn't received or processed properly
      if (this.playerId === null && this.socket) {
        const socketId = this.socket.id;
        console.log('🔧 NetworkManager: playerId is null, attempting to extract from gameState using socket ID:', socketId);
        
        // Find player with matching socket ID in the gameState
        const matchingPlayer = gameState.players?.find((player: any) => player.id === socketId);
        if (matchingPlayer) {
          this.playerId = matchingPlayer.id;
          console.log('🔧 NetworkManager: Successfully extracted playerId:', this.playerId);
        } else {
          console.warn('🚨 NetworkManager: Could not find matching player in gameState for socket:', socketId);
          console.log('Available players in gameState:', gameState.players?.map((p: any) => ({ id: p.id, name: p.name })));
        }
      }
      
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

  public getRoomInfo(roomId: string): Promise<{ roomId: string, player1Name: string, gridSize: any, playersCount: number }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject('Socket not initialized');
        return;
      }

      const handleRoomInfo = (info: any) => {
        this.socket?.off('room-info', handleRoomInfo);
        this.socket?.off('room-info-error', handleError);
        resolve(info);
      };

      const handleError = (error: string) => {
        this.socket?.off('room-info', handleRoomInfo);
        this.socket?.off('room-info-error', handleError);
        reject(error);
      };

      this.socket.once('room-info', handleRoomInfo);
      this.socket.once('room-info-error', handleError);

      this.socket.emit('get-room-info', { roomId });
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
    console.log('🔗 NetworkManager: getPlayerId() called, returning:', this.playerId);
    return this.playerId;
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
}