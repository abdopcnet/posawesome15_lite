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

// Hard-way translation loading: Replace Frappe translations with CSV translations
$(document).ready(() => {
	// Ensure __messages exists
	window.__messages = window.__messages || {};

	if (frappe.boot.lang === 'ar') {
		// Load Arabic translations from CSV
		const xhr = new XMLHttpRequest();
		xhr.open('GET', '/assets/posawesome/translations/ar.csv', false); // synchronous
		xhr.send();

		if (xhr.status === 200) {
			const csvLines = xhr.responseText.split('\n');
			const csvTranslations = {};

			csvLines.forEach(line => {
				if (!line.trim()) return;
				const commaIndex = line.indexOf(',');
				if (commaIndex > 0) {
					const key = line.substring(0, commaIndex).trim();
					const value = line.substring(commaIndex + 1).trim();
					if (key && value) csvTranslations[key] = value;
				}
			});

			// Replace Frappe translations with CSV translations using $.extend
			$.extend(window.__messages, csvTranslations);
			console.log('✅ Arabic translations loaded from ar.csv');
		}
	} else {
		// English: Keep Frappe translations as-is (already loaded in window.__messages)
		console.log('✅ Using English (Frappe default translations)');
	}
});

frappe.pages['posapp'].on_page_leave = function() {
	// Remove Material Design Icons CSS when leaving POS app
	$("head").find("link.posapp-mdi-css").remove();
};
