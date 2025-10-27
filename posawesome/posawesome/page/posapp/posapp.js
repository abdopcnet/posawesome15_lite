// @ts-nocheck
{% include "posawesome/posawesome/page/posapp/onscan.js" %}
{% include "posawesome/public/js/translations/ar.js" %}

// =============================================================================
// TRANSLATION SYSTEM - Initialize with selected language
// =============================================================================

// Manual language parameter - Change this to switch languages
const posa_language = 'ar'; // Options: 'ar' (Arabic) or 'en' (English)

// Initialize translation system after ar.js is loaded
if (typeof window.posaTranslationInit === 'function') {
	window.posaTranslationInit(posa_language);
} else {
	console.error('Translation system not loaded. Check if ar.js is included correctly.');
	// Fallback: setup basic __ function
	window.__ = function(msg) { return msg; };
	window.__messages = {};
}

// =============================================================================
// PAGE SETUP
// =============================================================================

frappe.pages['posapp'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Andalus Group',
		single_column: true
	});

	this.page.$PosApp = new frappe.PosApp.posapp(this.page);

	$('div.navbar-fixed-top').find('.container').css('padding', '0');

	// Load Material Design Icons CSS only for POS app
	$("head").append("<link rel='stylesheet' href='/assets/posawesome/css/materialdesignicons.css' class='posapp-mdi-css'>");

	// Fix shortcut.js offsetWidth error by hiding layout-main-section
	$("head").append("<style>.layout-main-section { display: none !important; }</style>");
};

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS when leaving POS app
	$("head").find("link.posapp-mdi-css").remove();
};
