import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameRenderer } from '../core/GameRenderer';
import * as THREE from 'three';

// Mock Three.js
vi.mock('three', () => {
  const actualThree = vi.importActual('three');
  
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    shadowMap = { enabled: false, type: 1 };
    private eventListeners: Map<string, Set<EventListener>> = new Map();
    
    constructor() {
      this.domElement = document.createElement('canvas');
      
      // Override addEventListener to track listeners
      const originalAddEventListener = this.domElement.addEventListener;
      const originalRemoveEventListener = this.domElement.removeEventListener;
      
      this.domElement.addEventListener = (type: string, listener: EventListener, options?: any) => {
        if (!this.eventListeners.has(type)) {
          this.eventListeners.set(type, new Set());
        }
        this.eventListeners.get(type)!.add(listener);
        originalAddEventListener.call(this.domElement, type, listener, options);
      };
      
      this.domElement.removeEventListener = (type: string, listener: EventListener, options?: any) => {
        if (this.eventListeners.has(type)) {
          this.eventListeners.get(type)!.delete(listener);
        }
        originalRemoveEventListener.call(this.domElement, type, listener, options);
      };
    }
    
    getListenerCount(type: string): number {
      return this.eventListeners.get(type)?.size || 0;
    }
    
    setSize() {}
    setPixelRatio() {}
    render() {}
    dispose() {}
  }
  
  return {
    ...actualThree,
    Color: vi.fn(() => ({})),
    WebGLRenderer: MockWebGLRenderer,
    Scene: vi.fn(() => ({ add: vi.fn(), remove: vi.fn() })),
    PerspectiveCamera: vi.fn(() => ({ 
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn()
    })),
    Group: vi.fn(() => ({ add: vi.fn(), remove: vi.fn(), clear: vi.fn(), rotation: { x: 0, y: 0 } })),
    DirectionalLight: vi.fn(() => ({ position: { set: vi.fn() } })),
    AmbientLight: vi.fn(() => ({})),
    Raycaster: vi.fn(() => ({ setFromCamera: vi.fn(), intersectObjects: vi.fn(() => []) })),
    Vector2: vi.fn(() => ({})),
    Vector3: vi.fn((x, y, z) => ({ x, y, z })),
    SphereGeometry: vi.fn(() => ({ dispose: vi.fn() })),
    BoxGeometry: vi.fn(() => ({ dispose: vi.fn() })),
    MeshPhongMaterial: vi.fn(() => ({ dispose: vi.fn() })),
    MeshBasicMaterial: vi.fn(() => ({ dispose: vi.fn() })),
    Mesh: vi.fn(() => ({ 
      position: { set: vi.fn() },
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn() }
    })),
    BufferGeometry: vi.fn(() => ({ 
      setFromPoints: vi.fn(),
      dispose: vi.fn()
    })),
    LineBasicMaterial: vi.fn(() => ({ dispose: vi.fn() })),
    Line: vi.fn(() => ({ 
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn() }
    })),
    Quaternion: vi.fn(() => ({ setFromAxisAngle: vi.fn(), multiply: vi.fn() }))
  };
});

describe('GameRenderer Memory Leaks', () => {
  let container: HTMLDivElement;
  let renderer: GameRenderer;
  let windowListeners: Map<string, Set<EventListener>>;
  
  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    // Track window event listeners
    windowListeners = new Map();
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;
    
    window.addEventListener = function(type: string, listener: EventListener, options?: any) {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, new Set());
      }
      windowListeners.get(type)!.add(listener);
      originalAddEventListener.call(this, type, listener, options);
    };
    
    window.removeEventListener = function(type: string, listener: EventListener, options?: any) {
      if (windowListeners.has(type)) {
        windowListeners.get(type)!.delete(listener);
      }
      originalRemoveEventListener.call(this, type, listener, options);
    };
  });
  
  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    document.body.removeChild(container);
  });
  
  it('should remove event listeners from renderer.domElement on dispose', () => {
    // Create renderer
    renderer = new GameRenderer(container, 3);
    
    // Get the mock renderer
    const mockRenderer = renderer['renderer'] as any;
    
    // Check that event listeners were added
    expect(mockRenderer.getListenerCount('mousemove')).toBeGreaterThan(0);
    expect(mockRenderer.getListenerCount('mousedown')).toBeGreaterThan(0);
    expect(mockRenderer.getListenerCount('mouseup')).toBeGreaterThan(0);
    expect(mockRenderer.getListenerCount('contextmenu')).toBeGreaterThan(0);
    
    // Get initial counts
    const initialMouseMoveCount = mockRenderer.getListenerCount('mousemove');
    const initialMouseDownCount = mockRenderer.getListenerCount('mousedown');
    const initialMouseUpCount = mockRenderer.getListenerCount('mouseup');
    const initialContextMenuCount = mockRenderer.getListenerCount('contextmenu');
    
    // Dispose the renderer
    renderer.dispose();
    
    // Check that event listeners were removed
    expect(mockRenderer.getListenerCount('mousemove')).toBeLessThan(initialMouseMoveCount);
    expect(mockRenderer.getListenerCount('mousedown')).toBeLessThan(initialMouseDownCount);
    expect(mockRenderer.getListenerCount('mouseup')).toBeLessThan(initialMouseUpCount);
    expect(mockRenderer.getListenerCount('contextmenu')).toBeLessThan(initialContextMenuCount);
    
    // Ideally should be 0, but we're checking for reduction to detect the issue
    expect(mockRenderer.getListenerCount('mousemove')).toBe(0);
    expect(mockRenderer.getListenerCount('mousedown')).toBe(0);
    expect(mockRenderer.getListenerCount('mouseup')).toBe(0);
    expect(mockRenderer.getListenerCount('contextmenu')).toBe(0);
  });
  
  it('should remove window resize listener on dispose', () => {
    // Get initial count of resize listeners
    const initialResizeCount = windowListeners.get('resize')?.size || 0;
    
    // Create renderer
    renderer = new GameRenderer(container, 3);
    
    // Check that resize listener was added
    const afterCreateCount = windowListeners.get('resize')?.size || 0;
    expect(afterCreateCount).toBeGreaterThan(initialResizeCount);
    
    // Dispose the renderer
    renderer.dispose();
    
    // Check that resize listener was removed
    const afterDisposeCount = windowListeners.get('resize')?.size || 0;
    expect(afterDisposeCount).toBe(initialResizeCount);
  });
  
  it('should not accumulate event listeners when creating multiple renderers', () => {
    // Create and dispose multiple renderers
    const renderer1 = new GameRenderer(container, 3);
    const mockRenderer1 = renderer1['renderer'] as any;
    
    // Get listener counts after first renderer
    const firstMouseMoveCount = mockRenderer1.getListenerCount('mousemove');
    const firstResizeCount = windowListeners.get('resize')?.size || 0;
    
    renderer1.dispose();
    
    // Create second renderer
    const renderer2 = new GameRenderer(container, 3);
    const mockRenderer2 = renderer2['renderer'] as any;
    
    // Get listener counts after second renderer
    const secondMouseMoveCount = mockRenderer2.getListenerCount('mousemove');
    const secondResizeCount = windowListeners.get('resize')?.size || 0;
    
    // Counts should be the same (not accumulating)
    expect(secondMouseMoveCount).toBe(firstMouseMoveCount);
    expect(secondResizeCount).toBe(firstResizeCount);
    
    renderer2.dispose();
    
    // After disposing both, counts should be back to 0
    expect(mockRenderer2.getListenerCount('mousemove')).toBe(0);
    expect(windowListeners.get('resize')?.size || 0).toBe(0);
  });
  
  it('should properly clean up when dispose is called multiple times', () => {
    renderer = new GameRenderer(container, 3);
    const mockRenderer = renderer['renderer'] as any;
    
    // First dispose
    renderer.dispose();
    expect(mockRenderer.getListenerCount('mousemove')).toBe(0);
    
    // Second dispose should not throw
    expect(() => renderer.dispose()).not.toThrow();
    
    // Listener count should still be 0
    expect(mockRenderer.getListenerCount('mousemove')).toBe(0);
  });
});