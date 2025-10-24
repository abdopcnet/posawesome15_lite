// Lazy loading utility for Vue components
export const lazyLoadComponent = (importFunction) => {
  return () => ({
    component: importFunction(),
    loading: {
      template: '<div class="loading-container"><div class="loading-spinner"></div><div class="loading-text">Loading...</div></div>',
      style: `
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 12px;
        }
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #1976d2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-text {
          font-size: 14px;
          color: #666;
        }
      `
    },
    error: {
      template: '<div class="error-container"><div class="error-icon">⚠️</div><div class="error-text">Failed to load component</div></div>',
      style: `
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 12px;
        }
        .error-icon {
          font-size: 24px;
        }
        .error-text {
          font-size: 14px;
          color: #f44336;
        }
      `
    },
    delay: 200,
    timeout: 10000
  })
}

// Performance monitoring utility
export const performanceMonitor = {
  startTime: null,
  
  start(label) {
    this.startTime = performance.now()
    console.log(`[Performance] Starting: ${label}`)
  },
  
  end(label) {
    if (this.startTime) {
      const duration = performance.now() - this.startTime
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`)
      this.startTime = null
      return duration
    }
    return 0
  },
  
  measure(label, fn) {
    this.start(label)
    const result = fn()
    this.end(label)
    return result
  }
}

// Bundle size analyzer
export const bundleAnalyzer = {
  analyze() {
    if (performance.memory) {
      const memoryInfo = {
        used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
      }
      console.log('[Bundle Analyzer] Memory Usage:', memoryInfo)
      return memoryInfo
    }
    return null
  }
}
