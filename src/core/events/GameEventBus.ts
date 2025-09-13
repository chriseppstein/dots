import { EventBus } from '../../shared/EventBus';
import { GameEventType, GameEventDataMap, IGameEventEmitter } from './GameEvents';

/**
 * Type-safe game event bus that wraps the generic EventBus
 * This provides compile-time type checking for all game events
 */
export class GameEventBus implements IGameEventEmitter {
  private eventBus: EventBus;
  
  constructor() {
    this.eventBus = new EventBus();
  }
  
  /**
   * Emit a type-safe game event
   */
  emit<T extends GameEventType>(event: T, data: GameEventDataMap[T]): void {
    this.eventBus.emit(event, data);
  }
  
  /**
   * Subscribe to a type-safe game event
   */
  on<T extends GameEventType>(
    event: T, 
    handler: (data: GameEventDataMap[T]) => void
  ): () => void {
    return this.eventBus.on(event, handler);
  }
  
  /**
   * Subscribe to a type-safe game event (one-time)
   */
  once<T extends GameEventType>(
    event: T, 
    handler: (data: GameEventDataMap[T]) => void
  ): () => void {
    return this.eventBus.once(event, handler);
  }
  
  /**
   * Unsubscribe from a type-safe game event
   */
  off<T extends GameEventType>(
    event: T, 
    handler?: (data: GameEventDataMap[T]) => void
  ): void {
    this.eventBus.off(event, handler);
  }
  
  /**
   * Clear all event handlers
   */
  clear(): void {
    this.eventBus.clear();
  }
  
  /**
   * Get the number of handlers for an event
   */
  getHandlerCount(event: GameEventType): number {
    return this.eventBus.getHandlerCount(event);
  }
}

/**
 * Global game event bus instance
 * This is the single source of truth for all game events
 */
export const gameEventBus = new GameEventBus();

/**
 * Helper function to create a scoped event bus for testing
 */
export function createScopedEventBus(): GameEventBus {
  return new GameEventBus();
}