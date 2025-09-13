import { GameState, GameMode, Point3D } from './types';
import { GameEngine } from './GameEngine';
import { GameEventBus, gameEventBus } from './events/GameEventBus';
import { GameEventType, createEventData } from './events/GameEvents';

/**
 * Centralized state management for the game.
 * Provides a single source of truth and notification system for state changes.
 */
export class GameStateManager {
  private engine: GameEngine;
  private listeners: Set<StateChangeListener> = new Set();
  private lastNotifiedState?: string; // JSON string for comparison
  private eventBus: GameEventBus;
  private eventUnsubscribers: Array<() => void> = [];

  constructor(engine: GameEngine, eventBus?: GameEventBus) {
    this.engine = engine;
    this.eventBus = eventBus || gameEventBus;
  }

  /**
   * Get the current game state
   */
  public getState(): GameState {
    return this.engine.getState();
  }

  /**
   * Make a move and notify listeners of state changes
   */
  public makeMove(start: Point3D, end: Point3D): boolean {
    const previousState = this.getState();
    const success = this.engine.makeMove(start, end);
    
    if (success) {
      this.notifyStateChange('move', { start, end, previousState });
    }
    
    return success;
  }

  /**
   * Sync with server state and notify listeners
   */
  public syncWithServerState(serverState: Partial<GameState>): void {
    const previousState = this.getState();
    
    try {
      this.engine.syncWithServerState(serverState);
      this.notifyStateChange('sync', { serverState, previousState });
    } catch (error) {
      this.notifyError('sync-error', error as Error);
    }
  }

  /**
   * Reset the game state and notify listeners
   */
  public resetGame(): void {
    const previousState = this.getState();
    this.engine.reset();
    this.notifyStateChange('reset', { previousState });
  }

  /**
   * Register a listener for state changes
   */
  public addListener(listener: StateChangeListener): void {
    this.listeners.add(listener);
    
    // Immediately notify new listener of current state
    try {
      const currentState = this.getState();
      listener.onStateChange?.('initial', currentState, { previousState: null });
    } catch (error) {
      console.error('Error notifying new listener:', error);
    }
  }

  /**
   * Remove a state change listener
   */
  public removeListener(listener: StateChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Force notify all listeners of current state (useful for debugging)
   */
  public forceNotify(): void {
    this.notifyStateChange('force-update', { previousState: this.getState() });
  }

  /**
   * Check if state has changed since last notification and notify if so
   */
  public checkAndNotifyChanges(): void {
    const currentState = this.getState();
    const currentStateJson = JSON.stringify(currentState);
    
    if (this.lastNotifiedState !== currentStateJson) {
      this.notifyStateChange('auto-detect', { previousState: null });
    }
  }

  /**
   * Notify all listeners of a state change
   */
  private notifyStateChange(changeType: StateChangeType, context: StateChangeContext): void {
    const currentState = this.getState();
    const currentStateJson = JSON.stringify(currentState);
    
    // Only notify if state actually changed
    if (this.lastNotifiedState === currentStateJson && changeType !== 'force-update') {
      return;
    }
    
    this.lastNotifiedState = currentStateJson;
    
    // Emit to EventBus
    this.emitToEventBus(changeType, currentState, context);
    
    // Notify all listeners (for backward compatibility)
    for (const listener of this.listeners) {
      try {
        listener.onStateChange?.call(listener, changeType, currentState, context);
        
        // Specific notifications
        if (currentState.winner && listener.onGameEnd) {
          listener.onGameEnd(currentState.winner, currentState);
        }
        
        if (changeType === 'move' && listener.onMove) {
          const moveContext = context as MoveContext;
          listener.onMove(moveContext.start!, moveContext.end!, currentState);
        }
        
        if (currentState.currentPlayer !== context.previousState?.currentPlayer && listener.onTurnChange) {
          listener.onTurnChange(currentState.currentPlayer, currentState);
        }
        
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    }
  }

  /**
   * Emit state changes to EventBus
   */
  private emitToEventBus(changeType: StateChangeType, currentState: GameState, context: StateChangeContext): void {
    const eventData = createEventData({
      previousState: context.previousState || {} as GameState,
      newState: currentState,
      changeType,
      source: 'GameStateManager'
    });
    
    // Emit main state change event
    this.eventBus.emit(GameEventType.STATE_CHANGED, eventData);
    
    // Emit specific events based on change type
    switch (changeType) {
      case 'move':
        const moveContext = context as MoveContext;
        if (moveContext.start && moveContext.end) {
          this.eventBus.emit(GameEventType.MOVE_MADE, createEventData({
            start: moveContext.start,
            end: moveContext.end,
            player: currentState.currentPlayer,
            line: currentState.lastMove!,
            turn: currentState.turn,
            source: 'GameStateManager'
          }));
        }
        break;
      
      case 'sync':
        this.eventBus.emit(GameEventType.STATE_SYNCED, createEventData({
          serverState: context.serverState || {},
          localState: currentState,
          source: 'GameStateManager'
        }));
        break;
      
      case 'reset':
        this.eventBus.emit(GameEventType.GAME_RESET, createEventData({
          gridSize: currentState.gridSize,
          mode: currentState.gameMode,
          source: 'GameStateManager'
        }));
        break;
    }
    
    // Check for game end
    if (currentState.winner) {
      this.eventBus.emit(GameEventType.GAME_ENDED, createEventData({
        winner: currentState.winner,
        finalState: currentState,
        duration: Date.now() - (context.previousState ? 0 : 0), // Would need start time
        moves: currentState.lines.length,
        source: 'GameStateManager'
      }));
    }
    
    // Check for turn change
    if (context.previousState && currentState.currentPlayer !== context.previousState.currentPlayer) {
      this.eventBus.emit(GameEventType.PLAYER_SWITCHED, createEventData({
        from: context.previousState.currentPlayer,
        to: currentState.currentPlayer,
        source: 'GameStateManager'
      }));
    }
  }

  /**
   * Notify listeners of errors
   */
  private notifyError(errorType: string, error: Error): void {
    // Emit to EventBus
    this.eventBus.emit(GameEventType.STATE_ERROR, createEventData({
      error,
      state: this.getState(),
      source: 'GameStateManager'
    }));
    
    // Notify listeners (for backward compatibility)
    for (const listener of this.listeners) {
      try {
        listener.onError?.(errorType, error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.listeners.clear();
    this.lastNotifiedState = undefined;
  }
}

/**
 * Interface for components that want to listen to state changes
 */
export interface StateChangeListener {
  /**
   * Called whenever the game state changes
   */
  onStateChange?(changeType: StateChangeType, newState: GameState, context: StateChangeContext): void;

  /**
   * Called when a move is made
   */
  onMove?(start: Point3D, end: Point3D, newState: GameState): void;

  /**
   * Called when the current player changes
   */
  onTurnChange?(newCurrentPlayer: any, newState: GameState): void;

  /**
   * Called when the game ends
   */
  onGameEnd?(winner: any, finalState: GameState): void;

  /**
   * Called when an error occurs
   */
  onError?(errorType: string, error: Error): void;
}

/**
 * Types of state changes that can occur
 */
export type StateChangeType = 'move' | 'sync' | 'reset' | 'initial' | 'force-update' | 'auto-detect';

/**
 * Context information provided with state changes
 */
export interface StateChangeContext {
  previousState?: GameState | null;
  serverState?: Partial<GameState>;
  start?: Point3D;
  end?: Point3D;
}

/**
 * Specific context for move operations
 */
interface MoveContext extends StateChangeContext {
  start: Point3D;
  end: Point3D;
}