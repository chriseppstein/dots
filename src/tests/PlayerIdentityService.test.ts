import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerIdentityService } from '../core/PlayerIdentityService';

describe('PlayerIdentityService', () => {
  let service: PlayerIdentityService;
  
  beforeEach(() => {
    service = new PlayerIdentityService();
  });
  
  describe('Basic Registration', () => {
    it('should register player mapping correctly', () => {
      service.registerPlayer('player1', 'socket-123', 'Alice');
      
      expect(service.getNetworkId('player1')).toBe('socket-123');
      expect(service.getEngineId('socket-123')).toBe('player1');
      expect(service.getPlayerName('player1')).toBe('Alice');
      expect(service.getPlayerName('socket-123')).toBe('Alice');
    });
    
    it('should handle multiple player registrations', () => {
      service.registerPlayer('player1', 'socket-123', 'Alice');
      service.registerPlayer('player2', 'socket-456', 'Bob');
      
      expect(service.getNetworkId('player1')).toBe('socket-123');
      expect(service.getNetworkId('player2')).toBe('socket-456');
      expect(service.getEngineId('socket-123')).toBe('player1');
      expect(service.getEngineId('socket-456')).toBe('player2');
    });
    
    it('should throw error for invalid registration', () => {
      expect(() => service.registerPlayer('', 'socket-123')).toThrow('Both engineId and networkId are required');
      expect(() => service.registerPlayer('player1', '')).toThrow('Both engineId and networkId are required');
    });
    
    it('should override existing mappings when re-registering', () => {
      service.registerPlayer('player1', 'socket-123', 'Alice');
      service.registerPlayer('player1', 'socket-456', 'Alice2');
      
      // Old mapping should be cleared
      expect(service.getEngineId('socket-123')).toBeUndefined();
      // New mapping should exist
      expect(service.getNetworkId('player1')).toBe('socket-456');
      expect(service.getPlayerName('player1')).toBe('Alice2');
    });
  });
  
  describe('ID Type Detection', () => {
    it('should correctly identify engine IDs', () => {
      expect(service.isEngineId('player1')).toBe(true);
      expect(service.isEngineId('player2')).toBe(true);
      expect(service.isEngineId('socket-123')).toBe(false);
      expect(service.isEngineId('random')).toBe(false);
    });
    
    it('should correctly identify network IDs', () => {
      service.registerPlayer('player1', 'socket-123');
      
      expect(service.isNetworkId('socket-123')).toBe(true);
      expect(service.isNetworkId('player1')).toBe(false);
      expect(service.isNetworkId('socket-456')).toBe(false);
    });
  });
  
  describe('ID Translation', () => {
    it('should translate engine ID to network ID', () => {
      service.registerPlayer('player1', 'socket-123');
      
      expect(service.translateId('player1')).toBe('socket-123');
    });
    
    it('should translate network ID to engine ID', () => {
      service.registerPlayer('player1', 'socket-123');
      
      expect(service.translateId('socket-123')).toBe('player1');
    });
    
    it('should return undefined for unknown IDs', () => {
      service.registerPlayer('player1', 'socket-123');
      
      expect(service.translateId('unknown')).toBeUndefined();
      expect(service.translateId('player2')).toBeUndefined(); // Not registered
    });
  });
  
  describe('Position-based Access', () => {
    it('should get engine ID by position', () => {
      expect(service.getEngineIdByPosition(0)).toBe('player1');
      expect(service.getEngineIdByPosition(1)).toBe('player2');
    });
    
    it('should throw for invalid position', () => {
      expect(() => service.getEngineIdByPosition(2)).toThrow('Invalid player position: 2');
      expect(() => service.getEngineIdByPosition(-1)).toThrow('Invalid player position: -1');
    });
    
    it('should get position by engine ID', () => {
      expect(service.getPositionByEngineId('player1')).toBe(0);
      expect(service.getPositionByEngineId('player2')).toBe(1);
    });
    
    it('should throw for invalid engine ID', () => {
      expect(() => service.getPositionByEngineId('player3')).toThrow('Invalid engine ID: player3');
      expect(() => service.getPositionByEngineId('socket-123')).toThrow('Invalid engine ID: socket-123');
    });
  });
  
  describe('Clear and Reset', () => {
    it('should clear all mappings', () => {
      service.registerPlayer('player1', 'socket-123', 'Alice');
      service.registerPlayer('player2', 'socket-456', 'Bob');
      
      service.clear();
      
      expect(service.getNetworkId('player1')).toBeUndefined();
      expect(service.getNetworkId('player2')).toBeUndefined();
      expect(service.getEngineId('socket-123')).toBeUndefined();
      expect(service.getEngineId('socket-456')).toBeUndefined();
      expect(service.getPlayerName('Alice')).toBeUndefined();
      expect(service.hasMappings()).toBe(false);
    });
  });
  
  describe('Debugging Support', () => {
    it('should return all mappings for debugging', () => {
      service.registerPlayer('player1', 'socket-123', 'Alice');
      service.registerPlayer('player2', 'socket-456', 'Bob');
      
      const mappings = service.getMappings();
      
      expect(mappings).toHaveLength(2);
      expect(mappings).toContainEqual({
        engineId: 'player1',
        networkId: 'socket-123',
        playerName: 'Alice'
      });
      expect(mappings).toContainEqual({
        engineId: 'player2',
        networkId: 'socket-456',
        playerName: 'Bob'
      });
    });
    
    it('should check if service has mappings', () => {
      expect(service.hasMappings()).toBe(false);
      
      service.registerPlayer('player1', 'socket-123');
      expect(service.hasMappings()).toBe(true);
      
      service.clear();
      expect(service.hasMappings()).toBe(false);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle player name updates', () => {
      service.registerPlayer('player1', 'socket-123', 'Alice');
      service.registerPlayer('player1', 'socket-123', 'Alice Updated');
      
      expect(service.getPlayerName('player1')).toBe('Alice Updated');
      expect(service.getPlayerName('socket-123')).toBe('Alice Updated');
    });
    
    it('should handle registration without player name', () => {
      service.registerPlayer('player1', 'socket-123');
      
      expect(service.getNetworkId('player1')).toBe('socket-123');
      expect(service.getPlayerName('player1')).toBeUndefined();
    });
    
    it('should handle re-registration with different socket ID (reconnection scenario)', () => {
      // Initial connection
      service.registerPlayer('player1', 'socket-123', 'Alice');
      
      // Simulate reconnection with new socket ID
      service.registerPlayer('player1', 'socket-789', 'Alice');
      
      // Old socket should not map to anything
      expect(service.getEngineId('socket-123')).toBeUndefined();
      
      // New socket should map correctly
      expect(service.getNetworkId('player1')).toBe('socket-789');
      expect(service.getEngineId('socket-789')).toBe('player1');
    });
    
    it('should handle socket ID reuse for different player', () => {
      // Player 1 with socket-123
      service.registerPlayer('player1', 'socket-123', 'Alice');
      
      // Later, player2 gets the same socket ID (after player1 disconnects)
      service.registerPlayer('player2', 'socket-123', 'Bob');
      
      // player1 should no longer have a network ID
      expect(service.getNetworkId('player1')).toBeUndefined();
      
      // socket-123 should now map to player2
      expect(service.getEngineId('socket-123')).toBe('player2');
      expect(service.getPlayerName('socket-123')).toBe('Bob');
    });
  });
  
  describe('Constants', () => {
    it('should expose standard player constants', () => {
      expect(PlayerIdentityService.PLAYER1).toBe('player1');
      expect(PlayerIdentityService.PLAYER2).toBe('player2');
    });
  });
});