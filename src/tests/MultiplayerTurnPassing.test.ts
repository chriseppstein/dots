import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameController } from '../core/GameController';
import { NetworkManager } from '../network/NetworkManager';

// Mock NetworkManager
vi.mock('../network/NetworkManager', () => {
  return {
    NetworkManager: vi.fn(() => ({}))
  };
});

describe('Multiplayer Turn Passing', () => {
  let controller1: GameController;
  let controller2: GameController;
  let mockNetworkManager1: any;
  let mockNetworkManager2: any;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Create mock network managers for both players
    mockNetworkManager1 = {
      connect: vi.fn().mockResolvedValue(undefined),
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      makeMove: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
      getRoomId: vi.fn().mockReturnValue('TEST-ROOM'),
      getPlayerId: vi.fn().mockReturnValue('player1-socket-id'), // Player 1
      isConnected: vi.fn().mockReturnValue(true),
      listeners: new Map()
    };

    mockNetworkManager2 = {
      connect: vi.fn().mockResolvedValue(undefined),
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      makeMove: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
      getRoomId: vi.fn().mockReturnValue('TEST-ROOM'),
      getPlayerId: vi.fn().mockReturnValue('player2-socket-id'), // Player 2
      isConnected: vi.fn().mockReturnValue(true),
      listeners: new Map()
    };

    // Mock the NetworkManager constructor to return appropriate mocks
    let callCount = 0;
    vi.mocked(NetworkManager).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockNetworkManager1 : mockNetworkManager2;
    });
    
    // Setup mock event handling for both
    mockNetworkManager1.on.mockImplementation((event: string, callback: Function) => {
      mockNetworkManager1.listeners.set(event, callback);
    });
    
    mockNetworkManager2.on.mockImplementation((event: string, callback: Function) => {
      mockNetworkManager2.listeners.set(event, callback);
    });
  });

  it('should allow both players to make moves when it is their turn', async () => {
    const gameState = {
      gridSize: 4,
      currentPlayer: { id: 'player1-socket-id', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 },
      players: [
        { id: 'player1-socket-id', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 },
        { id: 'player2-socket-id', name: 'Player 2', color: '#87CEEB', score: 0, squareCount: 0 }
      ],
      lines: [],
      cubes: [],
      turn: 0,
      winner: null,
      gameMode: 'online'
    };

    // Create game controllers for both players
    controller1 = new GameController(4, 'online', 'Player 1', 'Player 2', mockNetworkManager1);
    controller2 = new GameController(4, 'online', 'Player 2', 'Player 1', mockNetworkManager2);

    // Initialize both controllers with the game state
    controller1.initializeWithState(gameState);
    controller2.initializeWithState(gameState);

    // Verify Player 1 can make a move (it's their turn)
    const move1Success = controller1.handleMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(move1Success).toBe(true);
    expect(mockNetworkManager1.makeMove).toHaveBeenCalledWith(
      { x: 0, y: 0, z: 0 }, 
      { x: 1, y: 0, z: 0 }
    );

    // Verify Player 2 cannot make a move (not their turn)
    const move2Success = controller2.handleMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expect(move2Success).toBe(false);
    expect(mockNetworkManager2.makeMove).not.toHaveBeenCalled();
    
    // Verify Player 2 has a valid player ID (not null)
    expect(mockNetworkManager2.getPlayerId()).not.toBe(null);
    expect(mockNetworkManager2.getPlayerId()).toBe('player2-socket-id');
  });

  it('should properly handle turn switching', async () => {
    // Initial state - Player 1's turn
    const initialState = {
      gridSize: 4,
      currentPlayer: { id: 'player1-socket-id', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 },
      players: [
        { id: 'player1-socket-id', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 },
        { id: 'player2-socket-id', name: 'Player 2', color: '#87CEEB', score: 0, squareCount: 0 }
      ],
      lines: [],
      cubes: [],
      turn: 0,
      winner: null,
      gameMode: 'online'
    };

    // Create and initialize controllers
    controller1 = new GameController(4, 'online', 'Player 1', 'Player 2', mockNetworkManager1);
    controller2 = new GameController(4, 'online', 'Player 2', 'Player 1', mockNetworkManager2);
    
    controller1.initializeWithState(initialState);
    controller2.initializeWithState(initialState);

    // Player 1 makes a move
    const move1Success = controller1.handleMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(move1Success).toBe(true);

    // Updated state - Player 2's turn
    const updatedState = {
      ...initialState,
      currentPlayer: { id: 'player2-socket-id', name: 'Player 2', color: '#87CEEB', score: 0, squareCount: 0 },
      turn: 1,
      lines: [
        { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 }, player: { id: 'player1-socket-id', name: 'Player 1' } }
      ]
    };

    // Simulate server broadcasting the updated state
    controller1.handleServerStateUpdate(updatedState);
    controller2.handleServerStateUpdate(updatedState);

    // Now Player 2 should be able to make a move
    const move2Success = controller2.handleMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expect(move2Success).toBe(true);
    expect(mockNetworkManager2.makeMove).toHaveBeenCalled();

    // And Player 1 should be blocked
    const move1Again = controller1.handleMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    expect(move1Again).toBe(false);
  });

  it('should correctly sync currentPlayer reference after state updates', () => {
    // This test verifies the fix for the currentPlayer reference issue
    const gameState = {
      gridSize: 4,
      currentPlayer: { id: 'player2-socket-id', name: 'Player 2', color: '#87CEEB', score: 0, squareCount: 0 },
      players: [
        { id: 'player1-socket-id', name: 'Player 1', color: '#FF0000', score: 0, squareCount: 0 },
        { id: 'player2-socket-id', name: 'Player 2', color: '#87CEEB', score: 0, squareCount: 0 }
      ],
      lines: [],
      cubes: [],
      turn: 1,
      winner: null,
      gameMode: 'online'
    };

    controller2 = new GameController(4, 'online', 'Player 2', 'Player 1', mockNetworkManager2);
    controller2.initializeWithState(gameState);

    // Get the state after sync
    const syncedState = controller2.getState();
    
    // Verify currentPlayer is correctly set to Player 2
    expect(syncedState.currentPlayer.id).toBe('player2-socket-id');
    
    // Verify currentPlayer matches the player in the players array (content equality, not reference)
    const player2InArray = syncedState.players.find(p => p.id === 'player2-socket-id');
    expect(syncedState.currentPlayer).toStrictEqual(player2InArray);
    
    // Player 2 should be able to make a move
    const moveSuccess = controller2.handleMove({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expect(moveSuccess).toBe(true);
  });
});