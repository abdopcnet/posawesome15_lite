// @ts-nocheck
// =============================================================================
// POS AWESOME - POS Application Page
// =============================================================================
// This file handles the POS application page setup and translation system
//
// IMPORTANT: To change language, modify posa_language variable at line 11
// =============================================================================

{% include "posawesome/posawesome/page/posapp/onscan.js" %}
{% include "posawesome/posawesome/page/posapp/translations.js" %}

// =============================================================================
// TRANSLATION SYSTEM
// =============================================================================
// This section initializes the translation system from ar.js
//
// HOW TO USE:
// 1. Change posa_language to 'ar' for Arabic or 'en' for English
// 2. Reload the page
// 3. Use __() function in your code: __('Hello')
// =============================================================================

// Manual language parameter - Change this to switch languages
const posa_language = 'ar'; // Options: 'ar' (Arabic) or 'en' (English)

// Initialize translation system after ar.js is loaded
if (typeof window.posaTranslationInit === 'function') {
	// Successfully loaded ar.js - initialize with selected language
	window.posaTranslationInit(posa_language);
} else {
	// ar.js not loaded - show error and provide fallback
	console.error('Translation system not loaded. Check if ar.js is included correctly.');
	// Fallback: setup basic __ function (returns original text)
	window.__ = function(msg) { return msg; };
	window.__messages = {};
}

// =============================================================================
// PAGE SETUP
// =============================================================================
// This section handles the POS application page initialization
// - Creates the app page with title 'Andalus Group'
// - Initializes PosApp component
// - Applies CSS styles for Material Design Icons
// - Fixes shortcut.js layout issues
// =============================================================================

frappe.pages['posapp'].on_page_load = function (wrapper) {
	// Create the app page
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Andalus Group',
		single_column: true
	});

	// Initialize the POS App component
	this.page.$PosApp = new frappe.PosApp.posapp(this.page);

	// Adjust navbar padding
	$('div.navbar-fixed-top').find('.container').css('padding', '0');

	// Load Material Design Icons CSS for POS app
	$("head").append("<link rel='stylesheet' href='/assets/posawesome/css/materialdesignicons.css' class='posapp-mdi-css'>");

	// Fix shortcut.js offsetWidth error by hiding layout-main-section
	$("head").append("<style>.layout-main-section { display: none !important; }</style>");
};

// =============================================================================
// PAGE CLEANUP
// =============================================================================
// Clean up resources when leaving the POS app
// =============================================================================

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS to free up resources
	$("head").find("link.posapp-mdi-css").remove();
};
