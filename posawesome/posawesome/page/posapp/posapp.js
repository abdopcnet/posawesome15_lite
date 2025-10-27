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

// Replace Frappe translations completely with CSV translations after page loads
frappe.ready(() => {
	if (frappe.boot.lang === 'ar') {
		fetch('/assets/posawesome/translations/ar.csv')
			.then(response => response.text())
			.then(csvText => {
				// Delete Frappe translations completely and replace with CSV translations
				window.__messages = {};
				
				// Load only from CSV
				csvText.split('\n').forEach(line => {
					if (!line.trim()) return;
					const commaIndex = line.indexOf(',');
					if (commaIndex > 0) {
						const key = line.substring(0, commaIndex).trim();
						const value = line.substring(commaIndex + 1).trim();
						if (key && value) window.__messages[key] = value;
					}
				});
				
				console.log('✅ CSV translations loaded - Frappe translations replaced completely');
			})
			.catch(err => console.error('❌ Translation load error:', err));
	}
});

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS when leaving POS app
	$("head").find("link.posapp-mdi-css").remove();
};
