# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from . import __version__ as version

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
    "Company": "public/js/company.js",
}


doc_events = {
    "Sales Invoice": {
        "before_cancel": "posawesome.posawesome.api.before_cancel.before_cancel",
    },
}
