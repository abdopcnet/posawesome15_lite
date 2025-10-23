<template>
  <div class="virtual-scroll-container" ref="container" @scroll="handleScroll">
    <!-- Virtual scroll spacer for total height -->
    <div :style="{ height: totalHeight + 'px', position: 'relative' }">
      <!-- Visible items -->
      <div 
        :style="{ 
          transform: `translateY(${offsetY}px)`,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0
        }"
      >
        <div
          v-for="(item, index) in visibleItems"
          :key="item.item_code || item.idx"
          :style="{ height: itemHeight + 'px' }"
          class="virtual-item"
        >
          <slot :item="item" :index="startIndex + index">
            <!-- Default item rendering -->
            <div class="default-item">
              {{ item.item_name || item.name }}
            </div>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VirtualScroll',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    itemHeight: {
      type: Number,
      default: 60
    },
    containerHeight: {
      type: Number,
      default: 400
    },
    overscan: {
      type: Number,
      default: 5
    }
  },
  data() {
    return {
      scrollTop: 0,
      containerElement: null
    }
  },
  computed: {
    totalHeight() {
      return this.items.length * this.itemHeight
    },
    
    startIndex() {
      return Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.overscan)
    },
    
    endIndex() {
      const visibleCount = Math.ceil(this.containerHeight / this.itemHeight)
      return Math.min(
        this.items.length - 1,
        this.startIndex + visibleCount + this.overscan * 2
      )
    },
    
    visibleItems() {
      return this.items.slice(this.startIndex, this.endIndex + 1)
    },
    
    offsetY() {
      return this.startIndex * this.itemHeight
    }
  },
  mounted() {
    this.containerElement = this.$refs.container
    this.updateContainerHeight()
    
    // Listen for window resize
    window.addEventListener('resize', this.updateContainerHeight)
  },
  
  beforeUnmount() {
    window.removeEventListener('resize', this.updateContainerHeight)
  },
  
  methods: {
    handleScroll(event) {
      this.scrollTop = event.target.scrollTop
    },
    
    updateContainerHeight() {
      if (this.containerElement) {
        this.$emit('container-height-changed', this.containerElement.clientHeight)
      }
    },
    
    scrollToItem(index) {
      if (this.containerElement) {
        const scrollTop = index * this.itemHeight
        this.containerElement.scrollTop = scrollTop
      }
    },
    
    scrollToTop() {
      if (this.containerElement) {
        this.containerElement.scrollTop = 0
      }
    }
  }
}
</script>

<style scoped>
.virtual-scroll-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.virtual-item {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.default-item {
  padding: 12px 16px;
  font-size: 14px;
  color: #424242;
}

/* Custom scrollbar */
.virtual-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.virtual-scroll-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
