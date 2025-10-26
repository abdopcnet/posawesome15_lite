// @ts-nocheck
{% include "posawesome/posawesome/page/posapp/onscan.js" %}
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

//Arabic translations - Manual test (no async)
console.log('🌍 Current language:', frappe.boot.lang);
console.log('📥 Loading Arabic translations manually...');

// Ensure __messages exists before extending it
window.__messages = window.__messages || {};

// Manual test - add Print translation directly
window.__messages['Print'] = 'طباعة';
window.__messages['Pay'] = 'دفع';
window.__messages['Total Qty'] = 'إجمالي الكمية';

console.log('✅ Loaded manual translations into window.__messages');
console.log('🔍 Sample translations:', {
	'Print': window.__messages['Print'],
	'Pay': window.__messages['Pay'],
	'Total Qty': window.__messages['Total Qty']
});

// Update the global __() function to use our translations
console.log('🔄 Updating global __() function...');
window.__ = function(key) {
	const result = window.__messages[key] || key;
	console.log(`🌐 __("${key}") -> "${result}"`);
	return result;
};
console.log('✅ Global __() function updated');

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS when leaving POS app
	$("head").find("link.posapp-mdi-css").remove();
};
