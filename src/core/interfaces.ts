/**
 * Module Interfaces for Clear Architectural Boundaries
 * 
 * These interfaces define contracts between modules to reduce coupling
 * and improve testability.
 */

import { GameState, Point3D, Line, Player, GridSize, GameMode } from './types';
import { ValidationResult, MoveResult } from '../domain/GameRules';

/**
 * Game Engine Interface
 * Responsible for game logic and state management
 */
export interface IGameEngine {
  // State queries
  getState(): Readonly<GameState>;
  getCurrentPlayer(): Player;
  getWinner(): Player | null;
  getTurn(): number;
  
  // Move operations
  makeMove(start: Point3D, end: Point3D): MoveResult;
  validateMove(start: Point3D, end: Point3D): ValidationResult;
  getValidMoves(): Line[];
  
  // State management
  reset(): void;
  syncWithState(state: GameState): void;
}

/**
 * Network Service Interface
 * Handles all network communication
 */
export interface INetworkService {
  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  
  // Room management
  createRoom(playerName: string, gridSize: GridSize): Promise<string>;
  joinRoom(roomId: string, playerName: string): Promise<void>;
  getRoomInfo(roomId: string): Promise<RoomInfo>;
  leaveRoom(): void;
  
  // Game communication
  sendMove(start: Point3D, end: Point3D): Promise<void>;
  
  // Event handling
  on(event: NetworkEvent, handler: NetworkEventHandler): void;
  off(event: NetworkEvent): void;
  
  // Identity
  getPlayerId(): string | null;
  getRoomId(): string | null;
  
  // Cleanup
  dispose(): void;
}

/**
 * Renderer Interface
 * Handles all visual rendering
 */
export interface IRenderer {
  // Rendering
  render(state: GameState): void;
  updateFromGameState(state: GameState): void;
  
  // Configuration
  setSquareOpacity(opacity: number): void;
  setCameraPosition(x: number, y: number, z: number): void;
  
  // Interaction
  onLineClick(handler: LineClickHandler): void;
  
  // Lifecycle
  dispose(): void;
}

/**
 * State Store Interface
 * Single source of truth for game state
 */
export interface IGameStore {
  // State access
  getState(): Readonly<GameState>;
  
  // State updates
  dispatch(action: GameAction): void;
  
  // Subscriptions
  subscribe(listener: StateListener): Unsubscribe;
  
  // Queries
  selectPlayer(id: string): Player | null;
  selectCurrentPlayer(): Player;
  selectWinner(): Player | null;
  selectScore(): { player1: number; player2: number };
}

/**
 * AI Player Interface
 * Provides AI move generation
 */
export interface IAIPlayer {
  // Move generation
  getNextMove(): { start: Point3D; end: Point3D } | null;
  
  // Configuration
  setDifficulty(level: 'easy' | 'medium' | 'hard'): void;
}

/**
 * Controller Interface
 * Orchestrates game flow
 */
export interface IGameController {
  // Game management
  startGame(gridSize: GridSize, mode: GameMode, player1: string, player2: string): void;
  handleMove(start: Point3D, end: Point3D): boolean;
  reset(): void;
  
  // State access
  getState(): GameState;
  
  // Component attachment
  attachRenderer(renderer: IRenderer): void;
  attachNetwork(network: INetworkService): void;
  
  // Lifecycle
  dispose(): void;
}

/**
 * Resource Manager Interface
 * Manages lifecycle of resources
 */
export interface IResourceManager {
  // Timer management
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
  setInterval(callback: () => void, delay: number): number;
  clearInterval(id: number): void;
  
  // Animation frames
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
  
  // Event listeners
  addEventListener(element: EventTarget, event: string, handler: EventListener): void;
  removeEventListener(element: EventTarget, event: string, handler: EventListener): void;
  
  // Disposables
  registerDisposable(disposable: Disposable): void;
  
  // Cleanup
  dispose(): void;
  isDisposed(): boolean;
}

// Supporting types

export interface RoomInfo {
  roomId: string;
  players: string[];
  gridSize: GridSize;
  status: 'waiting' | 'full' | 'playing';
}

export type NetworkEvent = 
  | 'connected'
  | 'disconnected'
  | 'room-created'
  | 'room-joined'
  | 'player-joined'
  | 'player-left'
  | 'game-started'
  | 'game-state-update'
  | 'error';

export type NetworkEventHandler = (data?: any) => void;

export type LineClickHandler = (start: Point3D, end: Point3D) => void;

export type Unsubscribe = () => void;

export type StateListener = (state: GameState) => void;

export interface GameAction {
  type: string;
  payload?: any;
}

export interface Disposable {
  dispose(): void;
}

/**
 * Event Bus Interface
 * Centralized event management
 */
export interface IEventBus {
  // Event emission
  emit<T = any>(event: string, data?: T): void;
  
  // Event subscription
  on<T = any>(event: string, handler: EventHandler<T>): Unsubscribe;
  once<T = any>(event: string, handler: EventHandler<T>): Unsubscribe;
  
  // Cleanup
  off(event: string, handler?: EventHandler): void;
  clear(): void;
}

export type EventHandler<T = any> = (data: T) => void;

/**
 * Storage Service Interface
 * Abstracts localStorage access
 */
export interface IStorageService {
  // Game persistence
  saveGame(gameId: string, state: GameState): void;
  loadGame(gameId: string): GameState | null;
  deleteGame(gameId: string): void;
  
  // Settings
  saveSetting(key: string, value: any): void;
  loadSetting(key: string): any;
  
  // Room tokens
  saveRoomToken(roomId: string, token: string): void;
  getRoomToken(roomId: string): string | null;
  clearRoomToken(roomId: string): void;
}

/**
 * Component Factory Interface
 * Creates game components with proper dependencies
 */
export interface IComponentFactory {
  createGameEngine(gridSize: GridSize): IGameEngine;
  createRenderer(container: HTMLElement, gridSize: GridSize): IRenderer;
  createNetworkService(serverUrl?: string): INetworkService;
  createAIPlayer(engine: IGameEngine): IAIPlayer;
  createController(
    gridSize: GridSize,
    mode: GameMode,
    player1: string,
    player2: string
  ): IGameController;
  createResourceManager(): IResourceManager;
  createEventBus(): IEventBus;
  createStorageService(): IStorageService;
}