# -*- coding: utf-8 -*-

app_name = "posawesome"
app_title = "POS Awesome"
app_publisher = "future-support"
app_description = "posawesome"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "abdopcnet@gmail.com"
app_license = "GPLv3"


app_include_js = [
    "posawesome.bundle.js",
]


doctype_js = {
    "POS Profile": "public/js/pos_profile.js",
    "Sales Invoice": "public/js/invoice.js",
    "Sales Invoice": "public/js/sales_invoice.js",
    "Company": "public/js/company.js",

}


doc_events = {
    "Sales Invoice": {
        "before_cancel": "posawesome.posawesome.api.before_cancel.before_cancel",
    },
    "POS Closing Shift": {
        "before_cancel": "posawesome.posawesome.api.before_cancel.before_cancel_closing_shift",
    },
}

# Fixtures - bench --site erp.andalus-sweets.com export-fixtures --app posawesome
fixtures = [
    {
        "dt": "Custom HTML Block",
        "filters": [["name", "in", ["POS Awesome"]]]
    }
]
