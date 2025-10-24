import { createApp } from 'vue'
import { lazyLoadComponent, performanceMonitor, bundleAnalyzer } from './utils/lazyLoading.js'

// Lazy load main components
const Invoice = lazyLoadComponent(() => import('./components/pos/InvoiceOptimized.vue'))
const Payments = lazyLoadComponent(() => import('./components/pos/Payments.vue'))
const ItemsSelector = lazyLoadComponent(() => import('./components/pos/ItemsSelectorOptimized.vue'))
const Customer = lazyLoadComponent(() => import('./components/pos/Customer.vue'))
const Returns = lazyLoadComponent(() => import('./components/pos/Returns.vue'))
const PosOffers = lazyLoadComponent(() => import('./components/pos/PosOffers.vue'))
const PosCoupons = lazyLoadComponent(() => import('./components/pos/PosCoupons.vue'))

// Performance monitoring
performanceMonitor.start('App Initialization')

// Create Vue app with lazy-loaded components
const app = createApp({
  components: {
    Invoice,
    Payments,
    ItemsSelector,
    Customer,
    Returns,
    PosOffers,
    PosCoupons
  },
  
  mounted() {
    // Analyze bundle size after app loads
    setTimeout(() => {
      bundleAnalyzer.analyze()
      performanceMonitor.end('App Initialization')
    }, 1000)
  }
})

// Global performance monitoring
app.config.performance = true

// Error handling for lazy loading
app.config.errorHandler = (err, instance, info) => {
  console.error('[App Error]', err, info)
  performanceMonitor.end('Error Handling')
}

export default app
