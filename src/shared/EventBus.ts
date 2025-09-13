/**
 * EventBus Implementation
 * 
 * Centralized event management system to replace scattered event handling.
 * Provides a clean pub/sub pattern for component communication.
 */

import { IEventBus, EventHandler, Unsubscribe } from '../core/interfaces';

export class EventBus implements IEventBus {
  private events: Map<string, Set<EventHandler>> = new Map();
  private onceHandlers: WeakMap<EventHandler, Set<string>> = new WeakMap();

  /**
   * Emit an event with optional data
   */
  emit<T = any>(event: string, data?: T): void {
    const handlers = this.events.get(event);
    
    if (!handlers) return;
    
    // Create a copy to avoid issues if handlers modify the set
    const handlersCopy = Array.from(handlers);
    
    for (const handler of handlersCopy) {
      try {
        handler(data);
        
        // Remove if it was a once handler
        const onceEvents = this.onceHandlers.get(handler);
        if (onceEvents && onceEvents.has(event)) {
          handlers.delete(handler);
          onceEvents.delete(event);
          
          if (onceEvents.size === 0) {
            this.onceHandlers.delete(handler);
          }
        }
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
    }
    
    // Clean up empty handler sets
    if (handlers.size === 0) {
      this.events.delete(event);
    }
  }

  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, handler: EventHandler<T>): Unsubscribe {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    
    this.events.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event once
   */
  once<T = any>(event: string, handler: EventHandler<T>): Unsubscribe {
    // Track that this is a once handler
    if (!this.onceHandlers.has(handler)) {
      this.onceHandlers.set(handler, new Set());
    }
    this.onceHandlers.get(handler)!.add(event);
    
    // Add as regular handler (will be removed after first call)
    return this.on(event, handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      // Remove all handlers for this event
      this.events.delete(event);
      return;
    }
    
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
    
    // Clean up once handler tracking
    const onceEvents = this.onceHandlers.get(handler);
    if (onceEvents) {
      onceEvents.delete(event);
      
      if (onceEvents.size === 0) {
        this.onceHandlers.delete(handler);
      }
    }
  }

  /**
   * Clear all event handlers
   */
  clear(): void {
    this.events.clear();
    this.onceHandlers = new WeakMap();
  }

  /**
   * Get the number of handlers for an event
   */
  getHandlerCount(event: string): number {
    const handlers = this.events.get(event);
    return handlers ? handlers.size : 0;
  }

  /**
   * Get all registered events
   */
  getEvents(): string[] {
    return Array.from(this.events.keys());
  }
}

/**
 * Global event bus singleton
 */
export const globalEventBus = new EventBus();

/**
 * Game-specific events
 */
export enum GameEvent {
  // Game state events
  GAME_STARTED = 'game:started',
  GAME_ENDED = 'game:ended',
  GAME_RESET = 'game:reset',
  
  // Move events
  MOVE_MADE = 'move:made',
  MOVE_VALIDATED = 'move:validated',
  MOVE_REJECTED = 'move:rejected',
  
  // Turn events
  TURN_CHANGED = 'turn:changed',
  TURN_KEPT = 'turn:kept',
  
  // Score events
  SQUARE_COMPLETED = 'square:completed',
  CUBE_CLAIMED = 'cube:claimed',
  SCORE_UPDATED = 'score:updated',
  
  // Network events
  NETWORK_CONNECTED = 'network:connected',
  NETWORK_DISCONNECTED = 'network:disconnected',
  NETWORK_ERROR = 'network:error',
  
  // Room events
  ROOM_CREATED = 'room:created',
  ROOM_JOINED = 'room:joined',
  ROOM_LEFT = 'room:left',
  PLAYER_JOINED = 'player:joined',
  PLAYER_LEFT = 'player:left',
  
  // UI events
  VIEW_CHANGED = 'ui:view:changed',
  SETTINGS_CHANGED = 'ui:settings:changed',
  MODAL_OPENED = 'ui:modal:opened',
  MODAL_CLOSED = 'ui:modal:closed',
  
  // Error events
  ERROR_OCCURRED = 'error:occurred',
  ERROR_RECOVERED = 'error:recovered'
}

/**
 * Type-safe event data interfaces
 */
export interface GameEventData {
  [GameEvent.GAME_STARTED]: {
    gridSize: number;
    mode: string;
    players: Array<{ id: string; name: string }>;
  };
  
  [GameEvent.GAME_ENDED]: {
    winner: { id: string; name: string; score: number };
    finalScores: { player1: number; player2: number };
  };
  
  [GameEvent.MOVE_MADE]: {
    player: { id: string; name: string };
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    turn: number;
  };
  
  [GameEvent.SQUARE_COMPLETED]: {
    player: { id: string; name: string };
    square: any; // Square type
    count: number;
  };
  
  [GameEvent.CUBE_CLAIMED]: {
    player: { id: string; name: string };
    cube: any; // Cube type
    totalCubes: number;
  };
  
  [GameEvent.SCORE_UPDATED]: {
    player1Score: number;
    player2Score: number;
    player1Squares: number;
    player2Squares: number;
  };
  
  [GameEvent.NETWORK_ERROR]: {
    message: string;
    code?: string;
    details?: any;
  };
  
  [GameEvent.ROOM_CREATED]: {
    roomId: string;
    playerId: string;
  };
  
  [GameEvent.ROOM_JOINED]: {
    roomId: string;
    playerId: string;
    playerName: string;
  };
  
  [GameEvent.PLAYER_JOINED]: {
    playerId: string;
    playerName: string;
  };
  
  [GameEvent.PLAYER_LEFT]: {
    playerId: string;
    playerName: string;
  };
  
  [GameEvent.ERROR_OCCURRED]: {
    type: string;
    message: string;
    stack?: string;
    component?: string;
  };
}

/**
 * Type-safe event emitter wrapper
 */
export class TypedEventBus {
  private bus: EventBus;
  
  constructor(bus: EventBus = new EventBus()) {
    this.bus = bus;
  }
  
  emit<K extends keyof GameEventData>(
    event: K,
    data: GameEventData[K]
  ): void {
    this.bus.emit(event, data);
  }
  
  on<K extends keyof GameEventData>(
    event: K,
    handler: (data: GameEventData[K]) => void
  ): Unsubscribe {
    return this.bus.on(event, handler);
  }
  
  once<K extends keyof GameEventData>(
    event: K,
    handler: (data: GameEventData[K]) => void
  ): Unsubscribe {
    return this.bus.once(event, handler);
  }
  
  off<K extends keyof GameEventData>(
    event: K,
    handler?: (data: GameEventData[K]) => void
  ): void {
    this.bus.off(event, handler);
  }
  
  clear(): void {
    this.bus.clear();
  }
}

/**
 * Global typed event bus for game events
 */
export const gameEventBus = new TypedEventBus(globalEventBus);