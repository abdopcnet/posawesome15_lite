// @ts-nocheck
{% include "posawesome/posawesome/page/posapp/onscan.js" %}

// =============================================================================
// POS AWESOME - POS Application Page
// =============================================================================
// This file handles the POS application page setup and translation system
//
// IMPORTANT: To change language, modify posa_language variable below (line 32)
// =============================================================================

// =============================================================================
// TRANSLATION SYSTEM - EMBEDDED IN THIS FILE
// =============================================================================
// Translation data object containing all language translations
{% include "posawesome/posawesome/page/posapp/translations.js" %}
// =============================================================================

// =============================================================================
// MANUAL LANGUAGE SELECTION
// =============================================================================
// Change this variable to switch between Arabic and English
// Options: 'ar' (Arabic) or 'en' (English)
// After changing, reload the page for the new language to take effect
// =============================================================================
const posa_language = 'ar';

// =============================================================================
// INITIALIZE TRANSLATION SYSTEM
// =============================================================================
// This checks if translations.js was loaded and initializes the translation system
// If translations.js failed to load, provides a fallback that returns original text
// =============================================================================
if (typeof window.posaTranslationInit === 'function') {
	// Successfully loaded translations.js - initialize with selected language
	window.posaTranslationInit(posa_language);
} else {
	// translations.js not loaded - show error and provide fallback
	console.error('POS Awesome: Translation system not loaded. Using fallback.');
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
