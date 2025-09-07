import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSetup } from '../components/GameSetup';
import { NetworkManager } from '../network/NetworkManager';

// Mock NetworkManager to control the flow
vi.mock('../network/NetworkManager', () => {
  return {
    NetworkManager: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      createRoom: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn()
    }))
  };
});

describe('Waiting Room', () => {
  let gameSetup: GameSetup;
  let mockNetworkManager: any;

  beforeEach(() => {
    // Create a fresh GameSetup instance
    gameSetup = new GameSetup();
    document.body.appendChild(gameSetup);
    
    // Get the mocked NetworkManager instance
    mockNetworkManager = {
      connect: vi.fn().mockResolvedValue(undefined),
      createRoom: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
      listeners: new Map()
    };

    // Mock the NetworkManager constructor to return our mock
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

  it('should display waiting room after creating multiplayer game', async () => {
    // Wait for initial render and ensure connectedCallback is called
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Debug: Check shadow root exists
    expect(gameSetup.shadowRoot).toBeTruthy();
    
    // Start multiplayer mode selection
    const modeButton = gameSetup.shadowRoot?.querySelector('[data-mode="online"]') as HTMLButtonElement;
    expect(modeButton).toBeTruthy();
    modeButton?.click();
    
    // Wait for render after mode selection
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Debug: Check what's in the shadow root
    console.log('Shadow root HTML after mode selection:', gameSetup.shadowRoot?.innerHTML);
    
    // Set player name and create room
    const playerNameInput = gameSetup.shadowRoot?.querySelector('#player1') as HTMLInputElement;
    const createRoomButton = gameSetup.shadowRoot?.querySelector('#create-game') as HTMLButtonElement;
    
    expect(playerNameInput).toBeTruthy();
    expect(createRoomButton).toBeTruthy();
    
    if (playerNameInput && createRoomButton) {
      playerNameInput.value = 'Player 1';
      createRoomButton.click();
    }
    
    // Wait for network manager creation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Verify NetworkManager was created and room creation was called
    expect(NetworkManager).toHaveBeenCalled();
    expect(mockNetworkManager.connect).toHaveBeenCalled();
    expect(mockNetworkManager.createRoom).toHaveBeenCalledWith('Player 1', 4);
    
    // Simulate server response with room-created event
    const roomCreatedCallback = mockNetworkManager.listeners.get('room-created');
    expect(roomCreatedCallback).toBeTruthy();
    
    if (roomCreatedCallback) {
      roomCreatedCallback({
        roomId: 'TEST-ROOM-123',
        playerId: 'player1-socket-id'
      });
    }
    
    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Verify we're in the waiting room
    const waitingMessage = gameSetup.shadowRoot?.querySelector('.waiting-message');
    const copyUrlButton = gameSetup.shadowRoot?.querySelector('#copy-url');
    const spinner = gameSetup.shadowRoot?.querySelector('.spinner');
    
    expect(waitingMessage).toBeTruthy();
    expect(copyUrlButton).toBeTruthy();
    expect(spinner).toBeTruthy();
    
    // Verify waiting room contains correct text
    expect(waitingMessage?.textContent).toContain('Waiting for player 2 to join');
    
    // Verify game has NOT started yet (no gamestart event should be dispatched)
    let gameStartedEventFired = false;
    gameSetup.addEventListener('gamestart', () => {
      gameStartedEventFired = true;
    });
    
    // Wait a bit more to ensure no game start event fires
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(gameStartedEventFired).toBe(false);
  });

  it('should start game only when second player joins', async () => {
    // Setup: Create room and get to waiting room (same as above test)
    const modeButton = gameSetup.shadowRoot?.querySelector('[data-mode="online"]') as HTMLButtonElement;
    modeButton?.click();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const playerNameInput = gameSetup.shadowRoot?.querySelector('#player1') as HTMLInputElement;
    const createRoomButton = gameSetup.shadowRoot?.querySelector('#create-game') as HTMLButtonElement;
    
    if (playerNameInput && createRoomButton) {
      playerNameInput.value = 'Player 1';
      createRoomButton.click();
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Simulate room-created
    const roomCreatedCallback = mockNetworkManager.listeners.get('room-created');
    if (roomCreatedCallback) {
      roomCreatedCallback({
        roomId: 'TEST-ROOM-123',
        playerId: 'player1-socket-id'
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Verify we're in waiting room
    expect(gameSetup.shadowRoot?.querySelector('.waiting-message')).toBeTruthy();
    
    // Track game start event
    let gameStartedEventFired = false;
    let gameStartDetail: any = null;
    gameSetup.addEventListener('gamestart', (event: any) => {
      gameStartedEventFired = true;
      gameStartDetail = event.detail;
    });
    
    // Simulate second player joining (game-started event from server)
    const gameStartedCallback = mockNetworkManager.listeners.get('game-started');
    expect(gameStartedCallback).toBeTruthy();
    
    if (gameStartedCallback) {
      gameStartedCallback({
        gridSize: 4,
        currentPlayer: { id: 'player1-socket-id' },
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
    
    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Verify game start event was fired
    expect(gameStartedEventFired).toBe(true);
    expect(gameStartDetail).toBeTruthy();
    expect(gameStartDetail.gameMode).toBe('online');
  });
});