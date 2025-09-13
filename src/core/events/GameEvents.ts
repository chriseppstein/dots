import { GameState, Player, Point3D, Line, GameMove, GameMode, GridSize } from '../types';

/**
 * Comprehensive event types for the entire game system
 */
export enum GameEventType {
  // Game State Events
  STATE_CHANGED = 'state.changed',
  STATE_SYNCED = 'state.synced',
  STATE_VALIDATED = 'state.validated',
  STATE_ERROR = 'state.error',
  
  // Game Flow Events
  GAME_STARTED = 'game.started',
  GAME_ENDED = 'game.ended',
  GAME_RESET = 'game.reset',
  GAME_PAUSED = 'game.paused',
  GAME_RESUMED = 'game.resumed',
  
  // Move Events
  MOVE_MADE = 'move.made',
  MOVE_VALIDATED = 'move.validated',
  MOVE_REJECTED = 'move.rejected',
  SQUARE_COMPLETED = 'square.completed',
  CUBE_COMPLETED = 'cube.completed',
  
  // Turn Events
  TURN_STARTED = 'turn.started',
  TURN_ENDED = 'turn.ended',
  PLAYER_SWITCHED = 'player.switched',
  
  // Network Events
  NETWORK_CONNECTED = 'network.connected',
  NETWORK_DISCONNECTED = 'network.disconnected',
  NETWORK_ERROR = 'network.error',
  NETWORK_RECONNECTING = 'network.reconnecting',
  
  // Room Events
  ROOM_CREATED = 'room.created',
  ROOM_JOINED = 'room.joined',
  ROOM_LEFT = 'room.left',
  ROOM_CLOSED = 'room.closed',
  PLAYER_JOINED = 'player.joined',
  PLAYER_LEFT = 'player.left',
  
  // Server Sync Events
  SERVER_STATE_UPDATE = 'server.state.update',
  SERVER_MOVE_RECEIVED = 'server.move.received',
  SERVER_ERROR = 'server.error',
  
  // UI Events
  UI_MODE_SELECTED = 'ui.mode.selected',
  UI_SETTINGS_CHANGED = 'ui.settings.changed',
  UI_VIEW_ROTATED = 'ui.view.rotated',
  UI_READY = 'ui.ready',
  
  // Command Events
  COMMAND_EXECUTED = 'command.executed',
  COMMAND_FAILED = 'command.failed',
  COMMAND_UNDONE = 'command.undone',
  COMMAND_REDONE = 'command.redone'
}

/**
 * Base event data interface
 */
export interface BaseEventData {
  timestamp: number;
  source?: string;
}

/**
 * State change event data
 */
export interface StateChangeEventData extends BaseEventData {
  previousState: GameState;
  newState: GameState;
  changeType: string;
}

/**
 * Move event data
 */
export interface MoveEventData extends BaseEventData {
  start: Point3D;
  end: Point3D;
  player: Player;
  line: Line;
  turn: number;
}

/**
 * Square/Cube completion event data
 */
export interface CompletionEventData extends BaseEventData {
  player: Player;
  count: number;
  positions: Point3D[];
  totalScore: number;
}

/**
 * Network event data
 */
export interface NetworkEventData extends BaseEventData {
  status: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  message?: string;
  error?: Error;
}

/**
 * Room event data
 */
export interface RoomEventData extends BaseEventData {
  roomId: string;
  playerId?: string;
  playerName?: string;
  players?: Array<{ id: string; name: string }>;
  gameState?: GameState;
}

/**
 * Server sync event data
 */
export interface ServerSyncEventData extends BaseEventData {
  serverState: Partial<GameState>;
  localState: GameState;
  conflicts?: string[];
}

/**
 * UI event data
 */
export interface UIEventData extends BaseEventData {
  type: string;
  data: any;
}

/**
 * Command event data
 */
export interface CommandEventData extends BaseEventData {
  commandType: string;
  commandData: any;
  result?: any;
  error?: Error;
}

/**
 * Game start event data
 */
export interface GameStartEventData extends BaseEventData {
  mode: GameMode;
  gridSize: GridSize;
  players: Player[];
  roomId?: string;
}

/**
 * Game end event data
 */
export interface GameEndEventData extends BaseEventData {
  winner: Player;
  finalState: GameState;
  duration: number;
  moves: number;
}

/**
 * Map of event types to their data types
 */
export interface GameEventDataMap {
  [GameEventType.STATE_CHANGED]: StateChangeEventData;
  [GameEventType.STATE_SYNCED]: ServerSyncEventData;
  [GameEventType.STATE_VALIDATED]: StateChangeEventData;
  [GameEventType.STATE_ERROR]: { error: Error; state: GameState };
  
  [GameEventType.GAME_STARTED]: GameStartEventData;
  [GameEventType.GAME_ENDED]: GameEndEventData;
  [GameEventType.GAME_RESET]: { gridSize: GridSize; mode: GameMode };
  [GameEventType.GAME_PAUSED]: BaseEventData;
  [GameEventType.GAME_RESUMED]: BaseEventData;
  
  [GameEventType.MOVE_MADE]: MoveEventData;
  [GameEventType.MOVE_VALIDATED]: MoveEventData;
  [GameEventType.MOVE_REJECTED]: MoveEventData & { reason: string };
  [GameEventType.SQUARE_COMPLETED]: CompletionEventData;
  [GameEventType.CUBE_COMPLETED]: CompletionEventData;
  
  [GameEventType.TURN_STARTED]: { player: Player; turn: number };
  [GameEventType.TURN_ENDED]: { player: Player; turn: number };
  [GameEventType.PLAYER_SWITCHED]: { from: Player; to: Player };
  
  [GameEventType.NETWORK_CONNECTED]: NetworkEventData;
  [GameEventType.NETWORK_DISCONNECTED]: NetworkEventData;
  [GameEventType.NETWORK_ERROR]: NetworkEventData;
  [GameEventType.NETWORK_RECONNECTING]: NetworkEventData;
  
  [GameEventType.ROOM_CREATED]: RoomEventData;
  [GameEventType.ROOM_JOINED]: RoomEventData;
  [GameEventType.ROOM_LEFT]: RoomEventData;
  [GameEventType.ROOM_CLOSED]: RoomEventData;
  [GameEventType.PLAYER_JOINED]: RoomEventData;
  [GameEventType.PLAYER_LEFT]: RoomEventData;
  
  [GameEventType.SERVER_STATE_UPDATE]: ServerSyncEventData;
  [GameEventType.SERVER_MOVE_RECEIVED]: MoveEventData;
  [GameEventType.SERVER_ERROR]: { error: Error; context?: any };
  
  [GameEventType.UI_MODE_SELECTED]: UIEventData;
  [GameEventType.UI_SETTINGS_CHANGED]: UIEventData;
  [GameEventType.UI_VIEW_ROTATED]: UIEventData;
  [GameEventType.UI_READY]: UIEventData;
  
  [GameEventType.COMMAND_EXECUTED]: CommandEventData;
  [GameEventType.COMMAND_FAILED]: CommandEventData;
  [GameEventType.COMMAND_UNDONE]: CommandEventData;
  [GameEventType.COMMAND_REDONE]: CommandEventData;
}

/**
 * Type-safe event emitter interface
 */
export interface IGameEventEmitter {
  emit<T extends GameEventType>(event: T, data: GameEventDataMap[T]): void;
  on<T extends GameEventType>(event: T, handler: (data: GameEventDataMap[T]) => void): () => void;
  once<T extends GameEventType>(event: T, handler: (data: GameEventDataMap[T]) => void): () => void;
  off<T extends GameEventType>(event: T, handler?: (data: GameEventDataMap[T]) => void): void;
}

/**
 * Helper function to create event data with timestamp
 */
export function createEventData<T extends BaseEventData>(data: Omit<T, 'timestamp'>): T {
  return {
    ...data,
    timestamp: Date.now()
  } as T;
}