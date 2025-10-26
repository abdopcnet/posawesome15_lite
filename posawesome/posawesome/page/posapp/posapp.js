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

// Simple CSV Translation Loader
// Listens for POS Profile load event and loads translations from CSV file
window.addEventListener('posProfileLoaded', async (event) => {
	const pos_profile = event.detail.pos_profile;
	const language = pos_profile.posa_language;

	// Only load translations for Arabic (English is default, no translation needed)
	if (language === 'ar') {
		try {
			const response = await fetch('/assets/posawesome/translations/ar.csv');
			const csvText = await response.text();

			// Parse CSV and load into window.__messages
			window.__messages = window.__messages || {};
			const lines = csvText.split('\n');

			lines.forEach(line => {
				if (!line.trim()) return; // Skip empty lines

				// Handle CSV with commas in values (find first comma only)
				const commaIndex = line.indexOf(',');
				if (commaIndex > 0) {
					const key = line.substring(0, commaIndex).trim();
					const value = line.substring(commaIndex + 1).trim();
					if (key && value) {
						window.__messages[key] = value;
					}
				}
			});

			console.log('Arabic translations loaded from ar.csv');
			
			// Update the global __() function to use our translations
			if (typeof window.__messages !== 'undefined') {
				window.__ = function(key) {
					return window.__messages[key] || key;
				};
				
				// Also update Vue app's global property if it exists
				if (window.posApp && window.posApp.config && window.posApp.config.globalProperties) {
					window.posApp.config.globalProperties.__ = window.__;
					
					// Trigger translation update
					window.posApp.config.globalProperties.$translationUpdated = !window.posApp.config.globalProperties.$translationUpdated;
					
					// Force Vue app to re-render by updating reactive data
					if (window.posApp._instance && window.posApp._instance.proxy) {
						// Trigger reactivity update
						window.posApp._instance.proxy.$forceUpdate();
					}
					
					console.log('Vue app translation updated and forced re-render');
				}
			}
		} catch (error) {
			console.error('Failed to load Arabic translations:', error);
		}
	}
	// English = no translations needed (default Frappe behavior)
});

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS when leaving POS app
	$("head").find("link.posapp-mdi-css").remove();
};
