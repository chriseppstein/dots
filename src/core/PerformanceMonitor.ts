import Stats from 'stats.js';
import * as THREE from 'three';

/**
 * Performance metrics interface for comprehensive monitoring
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  renderCalls: number;
  triangleCount: number;
  geometryCount: number;
  textureCount: number;
  networkLatency?: number;
  stateUpdateTime?: number;
  renderBatchCount: number;
  objectPoolSize: number;
}

/**
 * Performance monitor for Three.js rendering and game state updates
 */
export class PerformanceMonitor {
  private stats: Stats;
  private renderer: THREE.WebGLRenderer;
  private startTime: number = 0;
  private frameCount: number = 0;
  private isVisible: boolean = false;
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    renderCalls: 0,
    triangleCount: 0,
    geometryCount: 0,
    textureCount: 0,
    renderBatchCount: 0,
    objectPoolSize: 0
  };

  // Performance thresholds for alerts
  private readonly THRESHOLDS = {
    MAX_FRAME_TIME: 16.67, // 60fps threshold
    MAX_RENDER_CALLS: 100,
    MAX_MEMORY_MB: 100,
    MAX_TRIANGLES: 100000
  };

  private performanceHistory: PerformanceMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 300; // 5 seconds at 60fps

  constructor(renderer: THREE.WebGLRenderer, container?: HTMLElement) {
    this.renderer = renderer;
    
    // Create stats display
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    
    // Style the stats panel
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '10px';
    this.stats.dom.style.right = '10px';
    this.stats.dom.style.zIndex = '10000';
    this.stats.dom.style.opacity = '0.8';
    
    if (container) {
      container.appendChild(this.stats.dom);
      this.isVisible = true;
    }
  }

  /**
   * Start monitoring a frame
   */
  public startFrame(): void {
    this.stats.begin();
    this.startTime = performance.now();
  }

  /**
   * End monitoring a frame and update metrics
   */
  public endFrame(): void {
    this.stats.end();
    
    const endTime = performance.now();
    this.metrics.frameTime = endTime - this.startTime;
    this.frameCount++;
    
    // Update metrics every frame for real-time monitoring
    this.updateMetrics();
    
    // Store history for trend analysis
    this.storeHistory();
    
    // Check for performance issues
    this.checkPerformanceThresholds();
  }

  /**
   * Update all performance metrics
   */
  private updateMetrics(): void {
    const info = this.renderer.info;
    
    // Basic rendering metrics
    this.metrics.fps = Math.round(1000 / this.metrics.frameTime);
    this.metrics.renderCalls = info.render.calls;
    this.metrics.triangleCount = info.render.triangles;
    this.metrics.geometryCount = info.memory.geometries;
    this.metrics.textureCount = info.memory.textures;
    
    // Memory usage (Chrome/Edge only)
    const perfMemory = (performance as any).memory;
    if (perfMemory) {
      this.metrics.memoryUsage = Math.round(
        perfMemory.usedJSHeapSize / 1048576 * 100
      ) / 100; // MB with 2 decimal places
    }
    
    // Calculate render batching efficiency
    this.metrics.renderBatchCount = this.calculateRenderBatches();
  }

  /**
   * Calculate render batching efficiency
   */
  private calculateRenderBatches(): number {
    // Estimate based on render calls vs geometry count
    const geometryCount = this.metrics.geometryCount;
    const renderCalls = this.metrics.renderCalls;
    
    if (geometryCount === 0) return 0;
    
    // Ideally, we want fewer render calls relative to geometry
    return Math.round((geometryCount / Math.max(renderCalls, 1)) * 100) / 100;
  }

  /**
   * Store performance history for trend analysis
   */
  private storeHistory(): void {
    this.performanceHistory.push({ ...this.metrics });
    
    if (this.performanceHistory.length > this.MAX_HISTORY_SIZE) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Check if performance metrics exceed thresholds
   */
  private checkPerformanceThresholds(): void {
    const issues: string[] = [];
    
    if (this.metrics.frameTime > this.THRESHOLDS.MAX_FRAME_TIME) {
      issues.push(`Frame time: ${this.metrics.frameTime.toFixed(2)}ms (target: <16.67ms)`);
    }
    
    if (this.metrics.renderCalls > this.THRESHOLDS.MAX_RENDER_CALLS) {
      issues.push(`Render calls: ${this.metrics.renderCalls} (target: <${this.THRESHOLDS.MAX_RENDER_CALLS})`);
    }
    
    if (this.metrics.memoryUsage > this.THRESHOLDS.MAX_MEMORY_MB) {
      issues.push(`Memory usage: ${this.metrics.memoryUsage}MB (target: <${this.THRESHOLDS.MAX_MEMORY_MB}MB)`);
    }
    
    if (this.metrics.triangleCount > this.THRESHOLDS.MAX_TRIANGLES) {
      issues.push(`Triangle count: ${this.metrics.triangleCount} (target: <${this.THRESHOLDS.MAX_TRIANGLES})`);
    }
    
    if (issues.length > 0 && this.frameCount % 300 === 0) { // Log every 5 seconds
      console.warn('Performance issues detected:', issues.join(', '));
    }
  }

  /**
   * Record state update performance
   */
  public recordStateUpdateTime(time: number): void {
    this.metrics.stateUpdateTime = Math.round(time * 100) / 100;
  }

  /**
   * Record network latency
   */
  public recordNetworkLatency(latency: number): void {
    this.metrics.networkLatency = Math.round(latency * 100) / 100;
  }

  /**
   * Record object pool size for memory tracking
   */
  public recordObjectPoolSize(size: number): void {
    this.metrics.objectPoolSize = size;
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance history for trend analysis
   */
  public getHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Get average metrics over the last N frames
   */
  public getAverageMetrics(frames: number = 60): Partial<PerformanceMetrics> {
    const recentHistory = this.performanceHistory.slice(-frames);
    if (recentHistory.length === 0) return {};
    
    const averages: Partial<PerformanceMetrics> = {};
    const keys: (keyof PerformanceMetrics)[] = [
      'fps', 'frameTime', 'memoryUsage', 'renderCalls', 
      'triangleCount', 'geometryCount', 'textureCount'
    ];
    
    keys.forEach(key => {
      const values = recentHistory.map(h => h[key] as number).filter(v => v !== undefined);
      if (values.length > 0) {
        averages[key] = Math.round(
          (values.reduce((sum, val) => sum + val, 0) / values.length) * 100
        ) / 100;
      }
    });
    
    return averages;
  }

  /**
   * Toggle stats visibility
   */
  public toggleVisibility(): void {
    if (this.stats.dom.parentElement) {
      this.stats.dom.style.display = this.isVisible ? 'none' : 'block';
      this.isVisible = !this.isVisible;
    }
  }

  /**
   * Show/hide the stats panel
   */
  public setVisible(visible: boolean): void {
    if (this.stats.dom.parentElement) {
      this.stats.dom.style.display = visible ? 'block' : 'none';
      this.isVisible = visible;
    }
  }

  /**
   * Reset all metrics and history
   */
  public reset(): void {
    this.frameCount = 0;
    this.performanceHistory = [];
    this.metrics = {
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      renderCalls: 0,
      triangleCount: 0,
      geometryCount: 0,
      textureCount: 0,
      renderBatchCount: 0,
      objectPoolSize: 0
    };
  }

  /**
   * Export performance data for analysis
   */
  public exportData(): {
    current: PerformanceMetrics;
    history: PerformanceMetrics[];
    averages: Partial<PerformanceMetrics>;
    timestamp: string;
  } {
    return {
      current: this.getMetrics(),
      history: this.getHistory(),
      averages: this.getAverageMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.stats.dom.parentElement) {
      this.stats.dom.parentElement.removeChild(this.stats.dom);
    }
    
    this.performanceHistory = [];
    this.isVisible = false;
  }
}