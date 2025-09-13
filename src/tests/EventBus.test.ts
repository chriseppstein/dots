import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, GameEvent, gameEventBus } from '../shared/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;
  
  beforeEach(() => {
    eventBus = new EventBus();
  });
  
  describe('Basic Functionality', () => {
    it('should emit and receive events', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      
      eventBus.emit('test', { data: 'test' });
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should handle multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      
      eventBus.emit('test', 'data');
      
      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
    });
    
    it('should not call handlers for different events', () => {
      const handler = vi.fn();
      eventBus.on('event1', handler);
      
      eventBus.emit('event2', 'data');
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('Once Functionality', () => {
    it('should call once handler only once', () => {
      const handler = vi.fn();
      eventBus.once('test', handler);
      
      eventBus.emit('test', 'first');
      eventBus.emit('test', 'second');
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('first');
    });
    
    it('should remove once handler after execution', () => {
      const handler = vi.fn();
      eventBus.once('test', handler);
      
      expect(eventBus.getHandlerCount('test')).toBe(1);
      
      eventBus.emit('test', 'data');
      
      expect(eventBus.getHandlerCount('test')).toBe(0);
    });
  });
  
  describe('Unsubscribe Functionality', () => {
    it('should unsubscribe via returned function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test', handler);
      
      unsubscribe();
      eventBus.emit('test', 'data');
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('should unsubscribe via off method', () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      
      eventBus.off('test', handler);
      eventBus.emit('test', 'data');
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('should remove all handlers when off called without handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      
      eventBus.off('test');
      eventBus.emit('test', 'data');
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });
  
  describe('Clear Functionality', () => {
    it('should clear all event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);
      
      eventBus.clear();
      
      eventBus.emit('event1', 'data');
      eventBus.emit('event2', 'data');
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should continue executing other handlers if one throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();
      
      eventBus.on('test', errorHandler);
      eventBus.on('test', successHandler);
      
      // Should not throw
      expect(() => eventBus.emit('test', 'data')).not.toThrow();
      
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });
  
  describe('Utility Methods', () => {
    it('should return handler count', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      expect(eventBus.getHandlerCount('test')).toBe(0);
      
      eventBus.on('test', handler1);
      expect(eventBus.getHandlerCount('test')).toBe(1);
      
      eventBus.on('test', handler2);
      expect(eventBus.getHandlerCount('test')).toBe(2);
      
      eventBus.off('test', handler1);
      expect(eventBus.getHandlerCount('test')).toBe(1);
    });
    
    it('should return list of events', () => {
      eventBus.on('event1', vi.fn());
      eventBus.on('event2', vi.fn());
      eventBus.on('event3', vi.fn());
      
      const events = eventBus.getEvents();
      
      expect(events).toContain('event1');
      expect(events).toContain('event2');
      expect(events).toContain('event3');
      expect(events).toHaveLength(3);
    });
  });
  
  describe('Game Events', () => {
    it('should handle typed game events', () => {
      const handler = vi.fn();
      
      gameEventBus.on(GameEvent.GAME_STARTED, handler);
      
      gameEventBus.emit(GameEvent.GAME_STARTED, {
        gridSize: 3,
        mode: 'local',
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ]
      });
      
      expect(handler).toHaveBeenCalledWith({
        gridSize: 3,
        mode: 'local',
        players: [
          { id: 'p1', name: 'Player 1' },
          { id: 'p2', name: 'Player 2' }
        ]
      });
    });
    
    it('should handle score update events', () => {
      const handler = vi.fn();
      
      gameEventBus.on(GameEvent.SCORE_UPDATED, handler);
      
      gameEventBus.emit(GameEvent.SCORE_UPDATED, {
        player1Score: 5,
        player2Score: 3,
        player1Squares: 10,
        player2Squares: 8
      });
      
      expect(handler).toHaveBeenCalledWith({
        player1Score: 5,
        player2Score: 3,
        player1Squares: 10,
        player2Squares: 8
      });
    });
  });
});