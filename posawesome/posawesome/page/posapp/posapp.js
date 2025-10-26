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
	console.log('🔍 posProfileLoaded event received:', event.detail);
	const pos_profile = event.detail.pos_profile;
	const language = pos_profile.posa_language;
	console.log('🌍 Language from POS Profile:', language);

	// Only load translations for Arabic (English is default, no translation needed)
	if (language === 'ar') {
		console.log('📥 Loading Arabic translations...');
		try {
			const response = await fetch('/assets/posawesome/translations/ar.csv');
			console.log('📡 CSV fetch response:', response.status, response.statusText);
			const csvText = await response.text();
			console.log('📄 CSV text length:', csvText.length);

			// Parse CSV and load into window.__messages
			window.__messages = window.__messages || {};
			const lines = csvText.split('\n');
			console.log('📝 CSV lines count:', lines.length);

			let loadedCount = 0;
			lines.forEach(line => {
				if (!line.trim()) return; // Skip empty lines

				// Handle CSV with commas in values (find first comma only)
				const commaIndex = line.indexOf(',');
				if (commaIndex > 0) {
					const key = line.substring(0, commaIndex).trim();
					const value = line.substring(commaIndex + 1).trim();
					if (key && value) {
						window.__messages[key] = value;
						loadedCount++;
					}
				}
			});

			console.log('✅ Loaded', loadedCount, 'translations into window.__messages');
			console.log('🔍 Sample translations:', {
				'Print': window.__messages['Print'],
				'Pay': window.__messages['Pay'],
				'Total Qty': window.__messages['Total Qty']
			});

			console.log('Arabic translations loaded from ar.csv');
			
			// Update the global __() function to use our translations
			if (typeof window.__messages !== 'undefined') {
				console.log('🔄 Updating global __() function...');
				window.__ = function(key) {
					const result = window.__messages[key] || key;
					console.log(`🌐 __("${key}") -> "${result}"`);
					return result;
				};
				
				// Also update Vue app's global property if it exists
				if (window.posApp && window.posApp.config && window.posApp.config.globalProperties) {
					console.log('🎯 Vue app found, updating global properties...');
					window.posApp.config.globalProperties.__ = window.__;
					
					// Trigger reactive update by changing translation trigger
					console.log('🔄 Triggering reactive update...');
					// Increment translation trigger to force re-render
					window.posApp.config.globalProperties.$translationTrigger++;
					console.log('✅ Translation trigger updated to:', window.posApp.config.globalProperties.$translationTrigger);
					
					// Also try force update as backup
					if (window.posApp._instance && window.posApp._instance.proxy) {
						window.posApp._instance.proxy.$forceUpdate();
						console.log('✅ Vue app re-render triggered');
					} else {
						console.log('❌ Vue app instance not found');
					}
				} else {
					console.log('❌ Vue app or global properties not found');
				}
			}
		} catch (error) {
			console.error('❌ Failed to load Arabic translations:', error);
		}
	} else {
		console.log('🌍 Language is not Arabic, skipping translation load');
	}
	// English = no translations needed (default Frappe behavior)
});

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS when leaving POS app
	$("head").find("link.posapp-mdi-css").remove();
};
