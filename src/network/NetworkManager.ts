import { io, Socket } from 'socket.io-client';
import { GameMove, GameState, GridSize, Point3D } from '../core/types';
import { GameEventBus, gameEventBus } from '../core/events/GameEventBus';
import { GameEventType, createEventData } from '../core/events/GameEvents';

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
  private eventBus: GameEventBus;

  constructor(serverUrl?: string, eventBus?: GameEventBus) {
    // Auto-detect server URL based on current host
    if (!serverUrl) {
      const host = window.location.hostname;
      const protocol = window.location.protocol;
      serverUrl = `${protocol}//${host}:3002`;
    }
    
    console.log('NetworkManager connecting to:', serverUrl);
    this.socket = io(serverUrl, {
      autoConnect: false
    });
    
    // Use provided EventBus or global one
    this.eventBus = eventBus || gameEventBus;
    
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
    // Emit to old callback system for backward compatibility
    const callback = this.callbacks.get(event);
    if (callback) {
      callback(data);
    }
    
    // Also emit to EventBus with proper event types
    this.emitToEventBus(event, data);
  }
  
  private emitToEventBus(event: string, data?: any): void {
    // Map old event names to new GameEventType
    switch (event) {
      case 'connected':
        this.eventBus.emit(GameEventType.NETWORK_CONNECTED, createEventData({
          status: 'connected',
          source: 'NetworkManager'
        }));
        break;
      case 'disconnected':
        this.eventBus.emit(GameEventType.NETWORK_DISCONNECTED, createEventData({
          status: 'disconnected',
          source: 'NetworkManager'
        }));
        break;
      case 'room-created':
        this.eventBus.emit(GameEventType.ROOM_CREATED, createEventData({
          roomId: data.roomId,
          playerId: data.playerId,
          source: 'NetworkManager'
        }));
        break;
      case 'room-joined':
        this.eventBus.emit(GameEventType.ROOM_JOINED, createEventData({
          roomId: data.roomId,
          playerId: data.playerId,
          gameState: data.gameState,
          source: 'NetworkManager'
        }));
        break;
      case 'player-joined':
        this.eventBus.emit(GameEventType.PLAYER_JOINED, createEventData({
          roomId: this.roomId || '',
          playerId: data.playerId,
          playerName: data.playerName,
          source: 'NetworkManager'
        }));
        break;
      case 'player-left':
        this.eventBus.emit(GameEventType.PLAYER_LEFT, createEventData({
          roomId: this.roomId || '',
          playerId: data.playerId,
          source: 'NetworkManager'
        }));
        break;
      case 'game-started':
        this.eventBus.emit(GameEventType.GAME_STARTED, createEventData({
          mode: 'online',
          gridSize: data.gridSize,
          players: data.players,
          roomId: this.roomId || undefined,
          source: 'NetworkManager'
        }));
        break;
      case 'move-made':
        this.eventBus.emit(GameEventType.SERVER_MOVE_RECEIVED, createEventData({
          start: data.start,
          end: data.end,
          player: data.player,
          line: data.line,
          turn: data.turn,
          source: 'NetworkManager'
        }));
        break;
      case 'game-state-update':
        this.eventBus.emit(GameEventType.SERVER_STATE_UPDATE, createEventData({
          serverState: data,
          localState: {} as GameState, // Will be filled by handler
          source: 'NetworkManager'
        }));
        break;
      case 'error':
        this.eventBus.emit(GameEventType.NETWORK_ERROR, createEventData({
          status: 'error',
          message: data,
          error: new Error(data),
          source: 'NetworkManager'
        }));
        break;
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

  /**
   * Properly dispose of all resources
   */
  public dispose(): void {
    // Clear all callbacks
    this.callbacks.clear();
    
    // Disconnect and clean up socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Clear state
    this.roomId = null;
    this.playerId = null;
  }
}