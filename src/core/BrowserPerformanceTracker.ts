/**
 * Browser Performance API tracker for measuring specific operations
 */
export class BrowserPerformanceTracker {
  private observer?: PerformanceObserver;
  private marks: Map<string, number> = new Map();
  private measurements: Map<string, number[]> = new Map();
  private isEnabled: boolean = true;

  constructor(enableLogging: boolean = false) {
    this.setupPerformanceObserver(enableLogging);
  }

  /**
   * Set up Performance Observer to track measurements
   */
  private setupPerformanceObserver(enableLogging: boolean): void {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      this.isEnabled = false;
      return;
    }

    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure') {
            // Store measurement for analysis
            if (!this.measurements.has(entry.name)) {
              this.measurements.set(entry.name, []);
            }
            this.measurements.get(entry.name)!.push(entry.duration);

            // Optional logging
            if (enableLogging) {
              console.log(`Performance: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
            }
          }
        });
      });

      this.observer.observe({ entryTypes: ['measure', 'mark'] });
    } catch (error) {
      console.warn('Failed to setup PerformanceObserver:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Create a performance mark
   */
  public mark(name: string): void {
    if (!this.isEnabled) return;

    try {
      performance.mark(name);
      this.marks.set(name, performance.now());
    } catch (error) {
      console.warn(`Failed to create mark "${name}":`, error);
    }
  }

  /**
   * Create a performance measurement between two marks
   */
  public measure(name: string, startMark: string, endMark?: string): number {
    if (!this.isEnabled) {
      return this.fallbackMeasure(name, startMark);
    }

    try {
      if (!endMark) {
        performance.mark(`${startMark}-end`);
        endMark = `${startMark}-end`;
      }

      performance.measure(name, startMark, endMark);

      const startTime = this.marks.get(startMark) || 0;
      const endTime = performance.now();
      return endTime - startTime;
    } catch (error) {
      console.warn(`Failed to measure "${name}":`, error);
      return this.fallbackMeasure(name, startMark);
    }
  }

  /**
   * Fallback measurement using stored timestamps
   */
  private fallbackMeasure(name: string, startMark: string): number {
    const startTime = this.marks.get(startMark);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    
    // Store the measurement manually
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return duration;
  }

  /**
   * Measure the execution time of a function
   */
  public measureFunction<T>(name: string, fn: () => T): T {
    if (!this.isEnabled) {
      return fn();
    }

    const startTime = performance.now();
    const result = fn();
    const duration = performance.now() - startTime;

    // Store measurement
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  /**
   * Measure async function execution time
   */
  public async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isEnabled) {
      return await fn();
    }

    const startTime = performance.now();
    const result = await fn();
    const duration = performance.now() - startTime;

    // Store measurement
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  /**
   * Get statistics for a specific measurement
   */
  public getStats(name: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
    last: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const total = measurements.reduce((sum, val) => sum + val, 0);
    const average = total / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const last = measurements[measurements.length - 1];

    return {
      count: measurements.length,
      total: Math.round(total * 100) / 100,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      last: Math.round(last * 100) / 100
    };
  }

  /**
   * Get all measurement names
   */
  public getMeasurementNames(): string[] {
    return Array.from(this.measurements.keys());
  }

  /**
   * Get recent measurements for a specific operation
   */
  public getRecentMeasurements(name: string, count: number = 10): number[] {
    const measurements = this.measurements.get(name);
    if (!measurements) return [];

    return measurements.slice(-count);
  }

  /**
   * Clear all measurements for a specific operation
   */
  public clearMeasurements(name?: string): void {
    if (name) {
      this.measurements.delete(name);
      this.marks.delete(name);
    } else {
      this.measurements.clear();
      this.marks.clear();
    }

    // Clear browser performance entries
    try {
      if (name) {
        performance.clearMarks(name);
        performance.clearMeasures(name);
      } else {
        performance.clearMarks();
        performance.clearMeasures();
      }
    } catch (error) {
      // Ignore errors - not all browsers support these methods
    }
  }

  /**
   * Get performance summary for all measurements
   */
  public getSummary(): Array<{
    name: string;
    count: number;
    average: number;
    min: number;
    max: number;
    total: number;
  }> {
    const summary: Array<{
      name: string;
      count: number;
      average: number;
      min: number;
      max: number;
      total: number;
    }> = [];

    this.measurements.forEach((measurements, name) => {
      const stats = this.getStats(name);
      if (stats) {
        summary.push({
          name,
          count: stats.count,
          average: stats.average,
          min: stats.min,
          max: stats.max,
          total: stats.total
        });
      }
    });

    // Sort by total time (highest first)
    summary.sort((a, b) => b.total - a.total);

    return summary;
  }

  /**
   * Export all performance data
   */
  public exportData(): {
    measurements: Record<string, number[]>;
    summary: Array<{
      name: string;
      count: number;
      average: number;
      min: number;
      max: number;
      total: number;
    }>;
    timestamp: string;
  } {
    const measurementsObj: Record<string, number[]> = {};
    this.measurements.forEach((values, key) => {
      measurementsObj[key] = [...values];
    });

    return {
      measurements: measurementsObj,
      summary: this.getSummary(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Start a timer for manual timing
   */
  public startTimer(name: string): () => number {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);

      return duration;
    };
  }

  /**
   * Check if performance tracking is enabled
   */
  public isTrackingEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }

    this.marks.clear();
    this.measurements.clear();
    this.isEnabled = false;
  }
}