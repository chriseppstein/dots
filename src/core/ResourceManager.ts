/**
 * ResourceManager provides a centralized system for tracking and cleaning up resources
 * to prevent memory leaks in the application.
 */
export class ResourceManager {
  private timers: Set<number> = new Set();
  private intervals: Set<number> = new Set();
  private eventListeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }> = [];
  private disposables: Set<Disposable> = new Set();
  private animationFrames: Set<number> = new Set();
  private abortControllers: Set<AbortController> = new Set();
  private isDisposed = false;

  /**
   * Register a timeout for automatic cleanup
   */
  public setTimeout(callback: () => void, delay: number): number {
    if (this.isDisposed) {
      console.warn('ResourceManager: Attempted to set timeout after disposal');
      return -1;
    }
    
    const timerId = window.setTimeout(() => {
      this.timers.delete(timerId);
      callback();
    }, delay);
    
    this.timers.add(timerId);
    return timerId;
  }

  /**
   * Clear a specific timeout
   */
  public clearTimeout(timerId: number): void {
    if (this.timers.has(timerId)) {
      window.clearTimeout(timerId);
      this.timers.delete(timerId);
    }
  }

  /**
   * Register an interval for automatic cleanup
   */
  public setInterval(callback: () => void, delay: number): number {
    if (this.isDisposed) {
      console.warn('ResourceManager: Attempted to set interval after disposal');
      return -1;
    }
    
    const intervalId = window.setInterval(callback, delay);
    this.intervals.add(intervalId);
    return intervalId;
  }

  /**
   * Clear a specific interval
   */
  public clearInterval(intervalId: number): void {
    if (this.intervals.has(intervalId)) {
      window.clearInterval(intervalId);
      this.intervals.delete(intervalId);
    }
  }

  /**
   * Register an animation frame for automatic cleanup
   */
  public requestAnimationFrame(callback: FrameRequestCallback): number {
    if (this.isDisposed) {
      console.warn('ResourceManager: Attempted to request animation frame after disposal');
      return -1;
    }
    
    const frameId = window.requestAnimationFrame((time) => {
      this.animationFrames.delete(frameId);
      callback(time);
    });
    
    this.animationFrames.add(frameId);
    return frameId;
  }

  /**
   * Cancel a specific animation frame
   */
  public cancelAnimationFrame(frameId: number): void {
    if (this.animationFrames.has(frameId)) {
      window.cancelAnimationFrame(frameId);
      this.animationFrames.delete(frameId);
    }
  }

  /**
   * Add an event listener that will be automatically removed on disposal
   */
  public addEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    if (this.isDisposed) {
      console.warn('ResourceManager: Attempted to add event listener after disposal');
      return;
    }
    
    element.addEventListener(event, handler, options);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * Remove a specific event listener
   */
  public removeEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener
  ): void {
    const index = this.eventListeners.findIndex(
      listener => 
        listener.element === element && 
        listener.event === event && 
        listener.handler === handler
    );
    
    if (index !== -1) {
      element.removeEventListener(event, handler);
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Register a disposable resource
   */
  public registerDisposable(disposable: Disposable): void {
    if (this.isDisposed) {
      console.warn('ResourceManager: Attempted to register disposable after disposal');
      disposable.dispose();
      return;
    }
    
    this.disposables.add(disposable);
  }

  /**
   * Unregister a disposable resource (useful if disposed elsewhere)
   */
  public unregisterDisposable(disposable: Disposable): void {
    this.disposables.delete(disposable);
  }

  /**
   * Create an AbortController that will be aborted on disposal
   */
  public createAbortController(): AbortController {
    if (this.isDisposed) {
      const controller = new AbortController();
      controller.abort();
      return controller;
    }
    
    const controller = new AbortController();
    this.abortControllers.add(controller);
    return controller;
  }

  /**
   * Clean up all managed resources
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    
    this.isDisposed = true;
    
    // Clear all timers
    this.timers.forEach(timerId => window.clearTimeout(timerId));
    this.timers.clear();
    
    // Clear all intervals
    this.intervals.forEach(intervalId => window.clearInterval(intervalId));
    this.intervals.clear();
    
    // Cancel all animation frames
    this.animationFrames.forEach(frameId => window.cancelAnimationFrame(frameId));
    this.animationFrames.clear();
    
    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    
    // Dispose all disposables
    this.disposables.forEach(disposable => {
      try {
        disposable.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    });
    this.disposables.clear();
    
    // Abort all abort controllers
    this.abortControllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    this.abortControllers.clear();
  }

  /**
   * Check if the resource manager has been disposed
   */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Get statistics about managed resources
   */
  public getStats(): ResourceStats {
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      animationFrames: this.animationFrames.size,
      eventListeners: this.eventListeners.length,
      disposables: this.disposables.size,
      abortControllers: this.abortControllers.size,
      isDisposed: this.isDisposed
    };
  }
}

/**
 * Interface for disposable resources
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Statistics about managed resources
 */
export interface ResourceStats {
  timers: number;
  intervals: number;
  animationFrames: number;
  eventListeners: number;
  disposables: number;
  abortControllers: number;
  isDisposed: boolean;
}

/**
 * Base class for components that need resource management
 */
export abstract class ManagedComponent implements Disposable {
  protected resourceManager = new ResourceManager();
  
  /**
   * Dispose the component and all its managed resources
   */
  public dispose(): void {
    this.resourceManager.dispose();
  }
  
  /**
   * Check if the component has been disposed
   */
  public get disposed(): boolean {
    return this.resourceManager.disposed;
  }
}