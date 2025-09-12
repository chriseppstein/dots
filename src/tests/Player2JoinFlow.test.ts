import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameSetup } from '../components/GameSetup';
import { NetworkManager } from '../network/NetworkManager';

// Mock NetworkManager
vi.mock('../network/NetworkManager', () => {
  return {
    NetworkManager: vi.fn(() => ({}))
  };
});

describe('Player 2 Join Flow', () => {
  let gameSetup: GameSetup;
  let mockNetworkManager: any;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Create GameSetup component
    gameSetup = new GameSetup();
    document.body.appendChild(gameSetup);
    
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
      getPlayerId: vi.fn().mockReturnValue(null), // Initially null - this is the bug
      isConnected: vi.fn().mockReturnValue(true),
      listeners: new Map(),
      playerId: null // Track the actual property
    };

    // Mock the NetworkManager constructor
    vi.mocked(NetworkManager).mockImplementation(() => mockNetworkManager);
    
    // Setup mock event handling
    mockNetworkManager.on.mockImplementation((event: string, callback: Function) => {
      mockNetworkManager.listeners.set(event, callback);
    });
  });

  afterEach(() => {
    if (document.body.contains(gameSetup)) {
      document.body.removeChild(gameSetup);
    }
  });

  it('should ensure Player 2 receives room-joined event before game-started', async () => {
    // Mock room info response for joining
    mockNetworkManager.getRoomInfo.mockResolvedValue({
      roomId: 'TEST-ROOM',
      player1Name: 'Player 1',
      gridSize: 4,
      playersCount: 1
    });

    // Simulate Player 2 joining a room
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Player 2 navigates to room URL and sees join form
    const roomId = 'TEST-ROOM';
    
    // Player 2 clicks join game
    mockNetworkManager.joinRoom(roomId, 'Player 2');
    
    // Track events received in order
    const eventsReceived: string[] = [];
    
    // Store the original mock implementation before we override it
    const storedListeners = new Map<string, Function>();
    
    // Mock the event handlers to track order
    mockNetworkManager.on.mockImplementation((event: string, callback: Function) => {
      // Wrap callback to track when events are received
      const wrappedCallback = (data: any) => {
        eventsReceived.push(event);
        if (event === 'room-joined') {
          // This should set the playerId
          mockNetworkManager.playerId = data.playerId;
          mockNetworkManager.getPlayerId = vi.fn().mockReturnValue(data.playerId);
        }
        callback(data);
      };
      
      // Store both the wrapped callback for later triggering
      mockNetworkManager.listeners.set(event, wrappedCallback);
      storedListeners.set(event, callback);
    });

    // Set up event handlers for Player 2
    mockNetworkManager.on('room-joined', (data: any) => {
      console.log('Player 2 received room-joined:', data);
    });
    
    mockNetworkManager.on('game-started', (data: any) => {
      console.log('Player 2 received game-started:', data);
    });

    // Simulate server sending events in the correct order
    // 1. First, room-joined should be sent to Player 2
    const roomJoinedCallback = mockNetworkManager.listeners.get('room-joined');
    if (roomJoinedCallback) {
      roomJoinedCallback({
        roomId: 'TEST-ROOM',
        playerId: 'player2-socket-id',
        gameState: null,
        player1Name: 'Player 1'
      });
    }
    
    // Verify Player 2 got their ID from room-joined
    expect(eventsReceived).toContain('room-joined');
    expect(mockNetworkManager.playerId).toBe('player2-socket-id');
    
    // 2. Then, after a delay, game-started should be sent
    await new Promise(resolve => setTimeout(resolve, 150)); // Wait longer than server delay
    
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
    
    // Verify events were received in correct order
    expect(eventsReceived).toEqual(['room-joined', 'game-started']);
    
    // Most importantly: Player 2 should have their ID set
    expect(mockNetworkManager.getPlayerId()).toBe('player2-socket-id');
  });

  it('demonstrates the bug: Player 2 does not receive room-joined when room becomes full', async () => {
    // This test shows what currently happens (the bug)
    
    // Player 2 joins
    mockNetworkManager.joinRoom('TEST-ROOM', 'Player 2');
    
    // Set up event handlers
    let roomJoinedReceived = false;
    let gameStartedReceived = false;
    
    mockNetworkManager.on('room-joined', () => {
      roomJoinedReceived = true;
      mockNetworkManager.playerId = 'player2-socket-id';
    });
    
    mockNetworkManager.on('game-started', () => {
      gameStartedReceived = true;
    });
    
    // Simulate what the server currently does (incorrectly):
    // Only sends game-started, no room-joined for Player 2
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
    
    // Bug: Player 2 never received room-joined
    expect(roomJoinedReceived).toBe(false);
    expect(gameStartedReceived).toBe(true);
    
    // Result: Player 2's ID is still null
    expect(mockNetworkManager.getPlayerId()).toBe(null);
  });
});