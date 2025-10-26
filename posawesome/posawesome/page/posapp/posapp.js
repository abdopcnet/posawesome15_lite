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

//Arabic translations - Always load Arabic translations
console.log('🌍 Current language:', frappe.boot.lang);
console.log('📥 Loading Arabic translations from CSV...');
// Ensure __messages exists before extending it
window.__messages = window.__messages || {};

// Load translations from CSV file
fetch('/assets/posawesome/translations/ar.csv')
	.then(response => {
		console.log('📡 CSV fetch response:', response.status, response.statusText);
		return response.text();
	})
	.then(csvText => {
		console.log('📄 CSV text length:', csvText.length);
		// Parse CSV and load into window.__messages
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
	})
	.catch(error => {
		console.error('❌ Failed to load Arabic translations:', error);
	});

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS when leaving POS app
	$("head").find("link.posapp-mdi-css").remove();
};
