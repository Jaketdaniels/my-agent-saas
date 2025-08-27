/**
 * Performance monitoring utilities
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();

  /**
   * Start measuring performance for an operation
   */
  start(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End measurement and record the metric
   */
  end(name: string, metadata?: Record<string, unknown>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`[Performance] No start time found for: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);
    this.log(metric);

    // Send to analytics if duration exceeds threshold
    if (duration > 1000) {
      this.reportSlowOperation(metric);
    }

    return duration;
  }

  /**
   * Measure a function's execution time
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name, { ...metadata, success: true });
      return result;
    } catch (error) {
      this.end(name, { ...metadata, success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Measure a synchronous function's execution time
   */
  measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    this.start(name);
    try {
      const result = fn();
      this.end(name, { ...metadata, success: true });
      return result;
    } catch (error) {
      this.end(name, { ...metadata, success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Log performance metric
   */
  private log(metric: PerformanceMetric): void {
    const level = metric.duration > 3000 ? 'warn' : 'log';
    console[level](
      `[PERF] ${metric.name}: ${metric.duration.toFixed(2)}ms`,
      metric.metadata || ''
    );
  }

  /**
   * Report slow operations for monitoring
   */
  private reportSlowOperation(metric: PerformanceMetric): void {
    console.warn(`[PERF] Slow operation detected:`, {
      name: metric.name,
      duration: `${metric.duration.toFixed(2)}ms`,
      threshold: '1000ms',
      timestamp: new Date(metric.timestamp).toISOString(),
      ...metric.metadata
    });

    // TODO: Send to external monitoring service
    // if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    //   // Send to monitoring service
    // }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Get performance statistics
   */
  getStats(name?: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } {
    const relevantMetrics = name
      ? this.metrics.filter(m => m.name === name)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return { count: 0, total: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const durations = relevantMetrics.map(m => m.duration).sort((a, b) => a - b);
    const total = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: durations.length,
      total,
      average: total / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Convenience function to measure performance
 */
export function measurePerformance(name: string) {
  const start = performance.now();
  return (metadata?: Record<string, unknown>) => {
    const duration = performance.now() - start;
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`, metadata || '');
    
    // Alert on slow operations
    if (duration > 100) {
      console.warn(`[PERF] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  };
}

/**
 * React hook for measuring component render performance
 */
export function usePerformance(componentName: string) {
  if (typeof window === 'undefined') return;

  const renderStart = performance.now();
  
  // Measure after paint
  requestAnimationFrame(() => {
    const renderTime = performance.now() - renderStart;
    if (renderTime > 50) {
      console.warn(
        `[PERF] Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`
      );
    }
  });
}

/**
 * Decorator for measuring method performance (experimental)
 */
export function measureMethod(target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (this: unknown, ...args: unknown[]) {
    const className = (target as { constructor: { name: string } }).constructor.name;
    const methodName = `${className}.${propertyKey}`;
    
    return performanceMonitor.measure(
      methodName,
      () => originalMethod.apply(this, args)
    );
  };

  return descriptor;
}