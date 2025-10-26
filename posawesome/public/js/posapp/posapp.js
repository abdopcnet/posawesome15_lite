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
    // Set up global properties that components might need
    app.config.globalProperties.$frappe = frappe;

    // Make __() function available for translation
    if (typeof __ !== 'undefined') {
        app.config.globalProperties.__ = __;
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
        this.$parent = $(document);
        this.page = parent.page;
        this.make_body();
    }

    make_body() {
        this.$el = this.$parent.find('.main-section');

        const app = createApp(Home);

        // Set up global properties BEFORE mounting
        SetVueGlobals(app);

        // Store app reference globally for translation updates
        window.posApp = app;

        // Mount the app
        app.mount(this.$el[0]);
    }

    setup_header() {
        // Implement header setup logic here
    }
};
