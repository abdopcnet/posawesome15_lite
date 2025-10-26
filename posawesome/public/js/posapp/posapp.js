import { createApp } from 'vue';
import Home from './Home.vue';

// Define Vue 3 feature flags for better tree-shaking and performance
// See: https://link.vuejs.org/feature-flags
if (typeof window !== 'undefined') {
    window.__VUE_OPTIONS_API__ = true;
    window.__VUE_PROD_DEVTOOLS__ = false;
    window.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;
}


// Define SetVueGlobals function to set up Vue global properties
function SetVueGlobals(app) {
    console.log('⚙️ SetVueGlobals called');
    // Set up global properties that components might need
    app.config.globalProperties.$frappe = frappe;

    // Make __() function available for translation
    if (typeof __ !== 'undefined') {
        console.log('🌐 Setting up __() function in Vue globals');
        app.config.globalProperties.__ = __;
    } else {
        console.log('❌ __() function not available yet');
    }

    // Make common Frappe utilities available globally
    if (typeof frappe !== 'undefined') {
        app.config.globalProperties.$call = frappe.call;
        app.config.globalProperties.$format = frappe.format;
        app.config.globalProperties.$db = frappe.db;
    }
}

frappe.provide('frappe.PosApp');

frappe.PosApp.posapp = class {
    constructor({ parent }) {
        console.log('🚀 PosApp constructor called');
        this.$parent = $(document);
        this.page = parent.page;
        this.make_body();
    }

    make_body() {
        console.log('🎨 make_body() called');
        this.$el = this.$parent.find('.main-section');

        const app = createApp(Home);
        console.log('📱 Vue app created');

        // Add reactive translation trigger
        app.config.globalProperties.$translationTrigger = 0;
        console.log('🔄 Added $translationTrigger reactive property');

        // Set up global properties BEFORE mounting
        SetVueGlobals(app);

        // Store app reference globally for translation updates
        window.posApp = app;
        console.log('💾 Vue app stored in window.posApp');

        // Mount the app
        app.mount(this.$el[0]);
        console.log('🎯 Vue app mounted');
    }

    setup_header() {
        // Implement header setup logic here
    }
};
