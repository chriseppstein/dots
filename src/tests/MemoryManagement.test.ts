import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameRenderer } from '../core/GameRenderer';
import { GameController } from '../core/GameController';
import { ResourceManager } from '../core/ResourceManager';
import { NetworkManager } from '../network/NetworkManager';
import * as THREE from 'three';

// Mock Three.js
vi.mock('three', () => ({
  Scene: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  })),
  PerspectiveCamera: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    lookAt: vi.fn()
  })),
  WebGLRenderer: vi.fn().mockImplementation(() => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    domElement: document.createElement('canvas'),
    render: vi.fn(),
    dispose: vi.fn()
  })),
  Raycaster: vi.fn(),
  Vector2: vi.fn(),
  Vector3: vi.fn(),
  Group: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  })),
  SphereGeometry: vi.fn(),
  CylinderGeometry: vi.fn(),
  BoxGeometry: vi.fn(),
  PlaneGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn().mockImplementation(() => ({
    dispose: vi.fn()
  })),
  Mesh: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    material: { dispose: vi.fn() },
    geometry: { dispose: vi.fn() }
  })),
  Color: vi.fn(),
  AmbientLight: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() }
  })),
  DirectionalLight: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    castShadow: false
  })),
  MeshPhongMaterial: vi.fn().mockImplementation(() => ({
    dispose: vi.fn()
  })),
  OrbitControls: vi.fn().mockImplementation(() => ({
    enableDamping: true,
    dampingFactor: 0.05,
    screenSpacePanning: false,
    minDistance: 3,
    maxDistance: 20,
    maxPolarAngle: Math.PI / 2,
    update: vi.fn(),
    dispose: vi.fn()
  }))
}));

describe('Memory Management', () => {
  describe('ResourceManager', () => {
    let resourceManager: ResourceManager;

    beforeEach(() => {
      resourceManager = new ResourceManager();
    });

    afterEach(() => {
      resourceManager.dispose();
    });

    it('should track and clean up timeouts', () => {
      const callback = vi.fn();
      const timerId = resourceManager.setTimeout(callback, 100);
      
      expect(timerId).toBeDefined();
      expect(timerId).not.toBe(-1);
      
      const stats = resourceManager.getStats();
      expect(stats.timers).toBe(1);
      
      resourceManager.dispose();
      
      const statsAfter = resourceManager.getStats();
      expect(statsAfter.timers).toBe(0);
      expect(statsAfter.isDisposed).toBe(true);
    });

    it('should track and clean up intervals', () => {
      const callback = vi.fn();
      const intervalId = resourceManager.setInterval(callback, 100);
      
      expect(intervalId).toBeDefined();
      expect(intervalId).not.toBe(-1);
      
      const stats = resourceManager.getStats();
      expect(stats.intervals).toBe(1);
      
      resourceManager.clearInterval(intervalId);
      
      const statsAfter = resourceManager.getStats();
      expect(statsAfter.intervals).toBe(0);
    });

    it('should track and clean up event listeners', () => {
      const element = document.createElement('div');
      const handler = vi.fn();
      
      resourceManager.addEventListener(element, 'click', handler);
      
      const stats = resourceManager.getStats();
      expect(stats.eventListeners).toBe(1);
      
      resourceManager.dispose();
      
      const statsAfter = resourceManager.getStats();
      expect(statsAfter.eventListeners).toBe(0);
    });

    it('should track and clean up animation frames', () => {
      const callback = vi.fn();
      const frameId = resourceManager.requestAnimationFrame(callback);
      
      expect(frameId).toBeDefined();
      expect(frameId).not.toBe(-1);
      
      const stats = resourceManager.getStats();
      expect(stats.animationFrames).toBe(1);
      
      resourceManager.cancelAnimationFrame(frameId);
      
      const statsAfter = resourceManager.getStats();
      expect(statsAfter.animationFrames).toBe(0);
    });

    it('should prevent operations after disposal', () => {
      resourceManager.dispose();
      
      const callback = vi.fn();
      const timerId = resourceManager.setTimeout(callback, 100);
      
      expect(timerId).toBe(-1);
      expect(resourceManager.disposed).toBe(true);
    });

    it('should handle disposable resources', () => {
      const mockDisposable = {
        dispose: vi.fn()
      };
      
      resourceManager.registerDisposable(mockDisposable);
      
      const stats = resourceManager.getStats();
      expect(stats.disposables).toBe(1);
      
      resourceManager.dispose();
      
      expect(mockDisposable.dispose).toHaveBeenCalled();
      const statsAfter = resourceManager.getStats();
      expect(statsAfter.disposables).toBe(0);
    });
  });

  describe('GameRenderer Memory Management', () => {
    let container: HTMLElement;
    let renderer: GameRenderer;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      if (renderer) {
        renderer.dispose();
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });

    it('should stop animation loop on disposal', () => {
      // Mock requestAnimationFrame to track calls
      let animationCallbacks: FrameRequestCallback[] = [];
      let frameId = 0;
      
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        animationCallbacks.push(callback);
        return ++frameId;
      });
      
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        // Remove callback
      });
      
      renderer = new GameRenderer(container, 3);
      
      // Animation should have started
      expect(animationCallbacks.length).toBeGreaterThan(0);
      
      // Dispose the renderer
      renderer.dispose();
      
      // Check that isDisposed flag is set (we can verify indirectly)
      expect(window.cancelAnimationFrame).toHaveBeenCalled();
      
      vi.restoreAllMocks();
    });

    it('should clean up ResourceManager on disposal', () => {
      // Mock the scene and renderer instances properly
      const mockScene = {
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn()
      };
      
      const mockRenderer = {
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        domElement: document.createElement('canvas'),
        render: vi.fn(),
        dispose: vi.fn()
      };
      
      const mockDirectionalLight = {
        position: { set: vi.fn() },
        castShadow: false
      };
      
      const mockCamera = {
        position: { set: vi.fn(), x: 0, y: 0, z: 0 },
        lookAt: vi.fn()
      };
      
      const mockGroup = {
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        position: { x: 0, y: 0, z: 0 }
      };
      
      const mockMesh = {
        position: { set: vi.fn(), x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        material: { dispose: vi.fn() },
        geometry: { dispose: vi.fn() },
        userData: {}
      };
      
      vi.mocked(THREE.Scene).mockImplementation(() => mockScene as any);
      vi.mocked(THREE.WebGLRenderer).mockImplementation(() => mockRenderer as any);
      vi.mocked(THREE.DirectionalLight).mockImplementation(() => mockDirectionalLight as any);
      vi.mocked(THREE.PerspectiveCamera).mockImplementation(() => mockCamera as any);
      vi.mocked(THREE.Group).mockImplementation(() => mockGroup as any);
      vi.mocked(THREE.Mesh).mockImplementation(() => mockMesh as any);
      
      renderer = new GameRenderer(container, 3);
      
      // Get access to the resource manager through reflection
      const resourceManager = (renderer as any).resourceManager;
      expect(resourceManager).toBeDefined();
      
      // Add some resources
      const callback = vi.fn();
      resourceManager.setTimeout(callback, 100);
      
      const statsBefore = resourceManager.getStats();
      expect(statsBefore.timers).toBeGreaterThan(0);
      
      // Dispose renderer
      renderer.dispose();
      
      // ResourceManager should be disposed
      const statsAfter = resourceManager.getStats();
      expect(statsAfter.isDisposed).toBe(true);
    });
  });

  describe('GameController Memory Management', () => {
    let controller: GameController;

    afterEach(() => {
      if (controller) {
        controller.dispose();
      }
    });

    it('should clean up AI move timers on disposal', () => {
      controller = new GameController(3, 'ai', 'Player 1', 'Player 2');
      
      // Get access to resource manager
      const resourceManager = (controller as any).resourceManager;
      expect(resourceManager).toBeDefined();
      
      // Trigger an AI move timer by simulating a move
      const state = controller.getState();
      state.currentPlayer.isAI = true;
      controller.onMove({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, state);
      
      const statsBefore = resourceManager.getStats();
      expect(statsBefore.timers).toBeGreaterThan(0);
      
      // Dispose controller
      controller.dispose();
      
      // All timers should be cleared
      const statsAfter = resourceManager.getStats();
      expect(statsAfter.isDisposed).toBe(true);
    });

    it('should properly dispose all dependencies', () => {
      const mockRenderer = {
        dispose: vi.fn(),
        updateFromGameState: vi.fn()
      };
      
      controller = new GameController(3, 'local', 'Player 1', 'Player 2');
      controller.attachRenderer(mockRenderer as any);
      
      // Spy on internal dispose methods
      const stateManagerDisposeSpy = vi.spyOn(controller.getStateManager(), 'dispose');
      const identityServiceClearSpy = vi.spyOn(controller.getPlayerIdentityService(), 'clear');
      
      controller.dispose();
      
      expect(mockRenderer.dispose).toHaveBeenCalled();
      expect(stateManagerDisposeSpy).toHaveBeenCalled();
      expect(identityServiceClearSpy).toHaveBeenCalled();
    });
  });

  describe('NetworkManager Memory Management', () => {
    let networkManager: NetworkManager;

    beforeEach(() => {
      networkManager = new NetworkManager();
    });

    afterEach(() => {
      if (networkManager) {
        networkManager.dispose();
      }
    });

    it('should clean up callbacks on disposal', () => {
      const callback = vi.fn();
      
      networkManager.on('test-event', callback);
      
      // Verify callback is registered
      const callbacks = (networkManager as any).callbacks;
      expect(callbacks.size).toBe(1);
      
      networkManager.dispose();
      
      // Callbacks should be cleared
      expect(callbacks.size).toBe(0);
    });

    it('should disconnect socket on disposal', () => {
      // Mock socket
      const mockSocket = {
        removeAllListeners: vi.fn(),
        disconnect: vi.fn(),
        connected: true
      };
      
      (networkManager as any).socket = mockSocket;
      
      expect(networkManager.isConnected()).toBe(true);
      
      networkManager.dispose();
      
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect((networkManager as any).socket).toBeNull();
    });

    it('should clear state on disposal', () => {
      // Set some state
      (networkManager as any).roomId = 'test-room';
      (networkManager as any).playerId = 'test-player';
      
      expect(networkManager.getRoomId()).toBe('test-room');
      expect(networkManager.getPlayerId()).toBe('test-player');
      
      networkManager.dispose();
      
      expect(networkManager.getRoomId()).toBeNull();
      expect(networkManager.getPlayerId()).toBeNull();
    });
  });

  describe('Web Component Lifecycle', () => {
    it('should clean up GameBoard on disconnectedCallback', async () => {
      // Mock the scene and renderer instances properly  
      const mockScene = {
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn()
      };
      
      const mockRenderer = {
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        domElement: document.createElement('canvas'),
        render: vi.fn(),
        dispose: vi.fn()
      };
      
      const mockDirectionalLight = {
        position: { set: vi.fn() },
        castShadow: false
      };
      
      const mockCamera = {
        position: { set: vi.fn(), x: 0, y: 0, z: 0 },
        lookAt: vi.fn()
      };
      
      const mockGroup = {
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        position: { x: 0, y: 0, z: 0 }
      };
      
      const mockMesh = {
        position: { set: vi.fn(), x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        material: { dispose: vi.fn() },
        geometry: { dispose: vi.fn() },
        userData: {}
      };
      
      vi.mocked(THREE.Scene).mockImplementation(() => mockScene as any);
      vi.mocked(THREE.WebGLRenderer).mockImplementation(() => mockRenderer as any);
      vi.mocked(THREE.DirectionalLight).mockImplementation(() => mockDirectionalLight as any);
      vi.mocked(THREE.PerspectiveCamera).mockImplementation(() => mockCamera as any);
      vi.mocked(THREE.Group).mockImplementation(() => mockGroup as any);
      vi.mocked(THREE.Mesh).mockImplementation(() => mockMesh as any);
      
      // Import GameBoard after mocks are set up
      await import('../components/GameBoard');
      
      const gameBoard = document.createElement('game-board') as any;
      document.body.appendChild(gameBoard);
      
      // Start a game to create resources
      gameBoard.startGame(3, 'local', 'Player 1', 'Player 2');
      
      // Verify resources exist
      expect(gameBoard.controller).toBeDefined();
      
      // Remove from DOM (triggers disconnectedCallback)
      document.body.removeChild(gameBoard);
      
      // Resources should be cleaned up
      expect(gameBoard.controller).toBeUndefined();
      expect(gameBoard.renderer).toBeUndefined();
    });

    it('should clean up GameSetup on disconnectedCallback', async () => {
      // Import GameSetup after mocks are set up
      await import('../components/GameSetup');
      
      const gameSetup = document.createElement('game-setup') as any;
      document.body.appendChild(gameSetup);
      
      // Create a mock network manager with all required methods
      const mockNetworkManager = {
        dispose: vi.fn(),
        disconnect: vi.fn(),
        off: vi.fn(),
        on: vi.fn()
      };
      
      gameSetup.networkManager = mockNetworkManager;
      
      // Remove from DOM (triggers disconnectedCallback)
      document.body.removeChild(gameSetup);
      
      // NetworkManager should be cleaned up (set to null in disconnectedCallback)
      expect(gameSetup.networkManager).toBeNull();
    });
  });
});