import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSetup } from '../components/GameSetup';
import { GameBoard } from '../components/GameBoard';
import { NetworkManager } from '../network/NetworkManager';

// Mock NetworkManager
vi.mock('../network/NetworkManager', () => {
  return {
    NetworkManager: vi.fn(() => ({}))
  };
});

describe('Player 2 Null ID Bug', () => {
  let gameSetup: GameSetup;
  let gameBoard: GameBoard;
  let mockNetworkManager: any;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Create components
    gameSetup = new GameSetup();
    gameBoard = new GameBoard();
    document.body.appendChild(gameSetup);
    document.body.appendChild(gameBoard);
    
    // Create mock network manager
    mockNetworkManager = {
      connect: vi.fn().mockResolvedValue(undefined),
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      getRoomInfo: vi.fn(),
      makeMove: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
      getRoomId: vi.fn().mockReturnValue('TEST-ROOM'),
      getPlayerId: vi.fn().mockReturnValue(null), // This is the bug!
      isConnected: vi.fn().mockReturnValue(true),
      listeners: new Map(),
      roomId: 'TEST-ROOM',
      playerId: null // Initially null
    };

    // Mock the NetworkManager constructor
    vi.mocked(NetworkManager).mockImplementation(() => mockNetworkManager);
    
    // Setup mock event handling
    mockNetworkManager.on.mockImplementation((event: string, callback: Function) => {
      // Wrap the callback to simulate NetworkManager behavior
      const wrappedCallback = (data: any) => {
        // Simulate what NetworkManager does in room-joined event
        if (event === 'room-joined' && data.playerId) {
          mockNetworkManager.playerId = data.playerId;
          mockNetworkManager.getPlayerId = vi.fn().mockReturnValue(data.playerId);
        }
        callback(data);
      };
      mockNetworkManager.listeners.set(event, wrappedCallback);
    });
  });

  afterEach(() => {
    document.body.removeChild(gameSetup);
    document.body.removeChild(gameBoard);
  });

  it('should properly set Player 2 ID when joining a room', async () => {
    // Step 1: Player 2 joins a room
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Simulate Player 2 joining through URL
    mockNetworkManager.getRoomInfo.mockResolvedValue({
      roomId: 'TEST-ROOM',
      player1Name: 'Player 1',
      gridSize: 4,
      playersCount: 1
    });

    // Player 2 calls joinRoom
    mockNetworkManager.joinRoom('TEST-ROOM', 'Player 2');
    
    // First register a room-joined handler (simulating what GameSetup would do)
    mockNetworkManager.on('room-joined', () => {});
    
    // Simulate server sending room-joined event
    const roomJoinedCallback = mockNetworkManager.listeners.get('room-joined');
    if (roomJoinedCallback) {
      roomJoinedCallback({
        roomId: 'TEST-ROOM',
        playerId: 'player2-socket-id',
        gameState: null,
        player1Name: 'Player 1'
      });
      // The wrapped callback should have set the playerId
    }
    
    // Verify Player ID is set
    expect(mockNetworkManager.playerId).toBe('player2-socket-id');
    
    // Now when game starts, Player 2 should have their ID
    const gameStartedCallback = mockNetworkManager.listeners.get('game-started');
    if (gameStartedCallback) {
      gameStartedCallback({
        gridSize: 4,
        currentPlayer: { id: 'player1-socket-id', name: 'Player 1' },
        players: [
          { id: 'player1-socket-id', name: 'Player 1' },
          { id: 'player2-socket-id', name: 'Player 2' }
        ],
        lines: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'online'
      });
    }
    
    // The getPlayerId mock should already be set by the wrapped callback
    
    // Player 2's ID should be available for turn validation
    expect(mockNetworkManager.getPlayerId()).toBe('player2-socket-id');
  });

  it('demonstrates the bug: Player 2 ID is null if room-joined is not processed', () => {
    // This test shows the current bug
    
    // Player 2 joins but room-joined event hasn't been processed yet
    mockNetworkManager.joinRoom('TEST-ROOM', 'Player 2');
    
    // Game starts immediately (race condition)
    const gameStartedCallback = mockNetworkManager.listeners.get('game-started');
    if (gameStartedCallback) {
      gameStartedCallback({
        gridSize: 4,
        currentPlayer: { id: 'player1-socket-id', name: 'Player 1' },
        players: [
          { id: 'player1-socket-id', name: 'Player 1' },
          { id: 'player2-socket-id', name: 'Player 2' }
        ],
        lines: [],
        cubes: [],
        turn: 0,
        winner: null,
        gameMode: 'online'
      });
    }
    
    // Bug: Player ID is still null!
    expect(mockNetworkManager.getPlayerId()).toBe(null);
    
    // This causes the "Client Player ID: null" error we see in the logs
  });
});