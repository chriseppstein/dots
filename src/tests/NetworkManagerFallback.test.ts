import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkManager } from '../network/NetworkManager';
import { io } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    id: 'test-socket-id'
  }))
}));

describe('NetworkManager Fallback Player ID', () => {
  let networkManager: NetworkManager;
  let mockSocket: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock socket
    mockSocket = {
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
      id: 'player2-socket-id' // This represents Player 2's socket ID
    };
    
    // Mock io to return our mock socket
    vi.mocked(io).mockReturnValue(mockSocket as any);
    
    // Create NetworkManager instance
    networkManager = new NetworkManager();
  });

  it('should extract playerId from game-started event when playerId is null', () => {
    // Verify initial state
    expect(networkManager.getPlayerId()).toBe(null);
    
    // Get the game-started event handler that was registered
    const gameStartedHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'game-started'
    )?.[1];
    
    expect(gameStartedHandler).toBeDefined();
    
    // Simulate receiving game-started event with player IDs matching socket IDs
    const gameState = {
      gridSize: 4,
      currentPlayer: { id: 'player1-socket-id', name: 'Player 1' },
      players: [
        { id: 'player1-socket-id', name: 'Player 1' },
        { id: 'player2-socket-id', name: 'Player 2' } // This matches our socket ID
      ],
      lines: [],
      cubes: [],
      turn: 0,
      winner: null,
      gameMode: 'online'
    };
    
    // Call the game-started handler
    gameStartedHandler(gameState);
    
    // Verify that playerId was extracted from the gameState
    expect(networkManager.getPlayerId()).toBe('player2-socket-id');
  });

  it('should not override existing playerId if already set', () => {
    // Simulate that room-joined was received first and set the playerId
    const roomJoinedHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'room-joined'
    )?.[1];
    
    expect(roomJoinedHandler).toBeDefined();
    
    // Player gets their ID from room-joined
    roomJoinedHandler({
      roomId: 'TEST-ROOM',
      playerId: 'player2-socket-id',
      gameState: null
    });
    
    // Verify playerId is set
    expect(networkManager.getPlayerId()).toBe('player2-socket-id');
    
    // Now simulate game-started event
    const gameStartedHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'game-started'
    )?.[1];
    
    const gameState = {
      players: [
        { id: 'player1-socket-id', name: 'Player 1' },
        { id: 'player2-socket-id', name: 'Player 2' }
      ]
    };
    
    gameStartedHandler(gameState);
    
    // Verify playerId remains unchanged (not overridden)
    expect(networkManager.getPlayerId()).toBe('player2-socket-id');
  });

  it('should handle case when socket ID is not found in gameState', () => {
    // Set a different socket ID that won't match gameState
    mockSocket.id = 'unknown-socket-id';
    
    const gameStartedHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'game-started'
    )?.[1];
    
    const gameState = {
      players: [
        { id: 'player1-socket-id', name: 'Player 1' },
        { id: 'player2-socket-id', name: 'Player 2' }
      ]
    };
    
    gameStartedHandler(gameState);
    
    // playerId should remain null since socket ID wasn't found
    expect(networkManager.getPlayerId()).toBe(null);
  });
});