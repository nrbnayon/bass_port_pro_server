/**
 * Memory Profiling & Monitoring Utility
 * Tracks heap memory usage, detects leaks, and logs warnings
 * 
 * Usage:
 *   const memoryMonitor = require('./memoryMonitor');
 *   memoryMonitor.start(); // Starts periodic monitoring
 *   
 * Or use as middleware:
 *   app.use(memoryMonitor.middleware());
 */

const os = require('os');

// Memory monitoring configuration
const config = {
  enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_MEMORY_MONITORING === 'true',
  intervalMs: 5 * 60 * 1000, // Check every 5 minutes
  warningThresholdMb: 500, // Warn if heap > 500MB
  criticalThresholdMb: 800, // Critical if heap > 800MB
  historySize: 12, // Keep last 12 measurements (= 1 hour with 5min interval)
};

let history = [];
let isMonitoring = false;

/**
 * Get current heap memory usage in MB
 */
const getCurrentHeap = () => {
  const heapUsed = process.memoryUsage().heapUsed;
  return Math.round(heapUsed / 1024 / 1024 * 100) / 100; // Round to 2 decimals
};

/**
 * Detect if memory is leaking based on trend
 */
const detectLeak = () => {
  if (history.length < 3) return false;
  
  // Check if last 3 measurements show consistent growth
  const last3 = history.slice(-3);
  return last3[0] < last3[1] && last3[1] < last3[2];
};

/**
 * Get memory statistics
 */
const getMemoryStats = () => {
  const heapStats = process.memoryUsage();
  return {
    heapUsedMb: Math.round(heapStats.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(heapStats.heapTotal / 1024 / 1024),
    rss_mb: Math.round(heapStats.rss / 1024 / 1024),
    external_mb: Math.round(heapStats.external / 1024 / 1024),
  };
};

/**
 * Check memory and log warnings
 */
const checkMemory = () => {
  const heapMb = getCurrentHeap();
  history.push(heapMb);
  
  // Keep only recent history
  if (history.length > config.historySize) {
    history.shift();
  }

  const stats = getMemoryStats();
  const isLeaking = detectLeak();

  // Log status
  console.log(`[Memory Monitor] Heap: ${stats.heapUsedMb}MB / ${stats.heapTotalMb}MB, RSS: ${stats.rss_mb}MB${isLeaking ? ' ⚠️ LEAK DETECTED' : ''}`);

  // Warnings
  if (stats.heapUsedMb > config.criticalThresholdMb) {
    console.error(`🚨 CRITICAL: Heap memory exceeds ${config.criticalThresholdMb}MB (${stats.heapUsedMb}MB)`);
    // In production, could trigger alerts, graceful restart, etc.
  } else if (stats.heapUsedMb > config.warningThresholdMb) {
    console.warn(`⚠️ WARNING: Heap memory is high (${stats.heapUsedMb}MB)`);
  }

  if (isLeaking) {
    console.warn(`⚠️ LEAK WARNING: Memory appears to be growing consistently. Last 3 measurements: ${history.slice(-3).join('MB, ')}MB`);
  }

  return stats;
};

/**
 * Start continuous memory monitoring
 */
const start = () => {
  if (!config.enabled) {
    console.log('[Memory Monitor] Disabled (set ENABLE_MEMORY_MONITORING=true to enable)');
    return;
  }

  if (isMonitoring) return;
  isMonitoring = true;

  // Initial check
  checkMemory();

  // Periodic checks
  const interval = setInterval(checkMemory, config.intervalMs);
  interval.unref(); // Allow process to exit even if interval is pending

  console.log(`[Memory Monitor] Started (interval: ${config.intervalMs}ms, warning: ${config.warningThresholdMb}MB)`);

  // Graceful cleanup
  process.on('exit', () => {
    clearInterval(interval);
  });
};

/**
 * Express/Connect middleware for adding memory info to response headers
 */
const middleware = () => {
  return (req, res, next) => {
    const stats = getMemoryStats();
    res.setHeader('X-Memory-Heap-MB', stats.heapUsedMb);
    res.setHeader('X-Memory-RSS-MB', stats.rss_mb);
    next();
  };
};

/**
 * Force garbage collection (requires running with --expose-gc flag)
 */
const forceGC = () => {
  if (global.gc) {
    global.gc();
    console.log('[Memory Monitor] Forced garbage collection');
    return getMemoryStats();
  } else {
    console.warn('[Memory Monitor] GC not available. Run with --expose-gc flag');
    return null;
  }
};

/**
 * Get current memory snapshot for debugging
 */
const getSnapshot = () => {
  return {
    timestamp: new Date().toISOString(),
    stats: getMemoryStats(),
    history: history,
    isLeaking: detectLeak(),
    uptime: process.uptime(),
  };
};

module.exports = {
  start,
  middleware,
  checkMemory,
  forceGC,
  getSnapshot,
  getMemoryStats,
  config,
};
