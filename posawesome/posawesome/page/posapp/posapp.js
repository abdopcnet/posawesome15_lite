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

//Arabic translations - Load from CSV file system only if user language is Arabic
if (frappe.boot.lang === "ar") {
	window.__messages = window.__messages || {};

	const xhr = new XMLHttpRequest();
	xhr.open('GET', '/assets/posawesome/translations/ar.csv', false);
	xhr.send();

	if (xhr.status === 200) {
		const lines = xhr.responseText.split('\n');
		
		lines.forEach(line => {
			if (!line.trim()) return;
			
			const commaIndex = line.indexOf(',');
			if (commaIndex > 0) {
				const key = line.substring(0, commaIndex).trim();
				const value = line.substring(commaIndex + 1).trim();
				if (key && value) {
					window.__messages[key] = value;
				}
			}
		});
	}

	// Update the global __() function to use our translations
	window.__ = function(key) {
		return window.__messages[key] || key;
	};
}

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS when leaving POS app
	$("head").find("link.posapp-mdi-css").remove();
};
