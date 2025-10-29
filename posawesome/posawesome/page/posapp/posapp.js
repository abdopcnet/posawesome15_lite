!(function (e, t) {
  'object' == typeof exports && 'undefined' != typeof module
    ? (module.exports = t())
    : 'function' == typeof define && define.amd
      ? define(t())
      : (e.onScan = t());
})(this, function () {
  var d = {
    attachTo: function (e, t) {
      if (void 0 !== e.scannerDetectionData)
        throw new Error('onScan.js is already initialized for DOM element ' + e);
      var n = {
        onScan: function (e, t) {},
        onScanError: function (e) {},
        onKeyProcess: function (e, t) {},
        onKeyDetect: function (e, t) {},
        onPaste: function (e, t) {},
        keyCodeMapper: function (e) {
          return d.decodeKeyEvent(e);
        },
        onScanButtonLongPress: function () {},
        scanButtonKeyCode: !1,
        scanButtonLongPressTime: 500,
        timeBeforeScanTest: 100,
        avgTimeByChar: 30,
        minLength: 6,
        suffixKeyCodes: [9, 13],
        prefixKeyCodes: [],
        ignoreIfFocusOn: !1,
        stopPropagation: !1,
        preventDefault: !1,
        captureEvents: !1,
        reactToKeydown: !0,
        reactToPaste: !1,
        singleScanQty: 1,
      };
      return (
        (t = this._mergeOptions(n, t)),
        (e.scannerDetectionData = {
          options: t,
          vars: {
            firstCharTime: 0,
            lastCharTime: 0,
            accumulatedString: '',
            testTimer: !1,
            longPressTimeStart: 0,
            longPressed: !1,
          },
        }),
        !0 === t.reactToPaste && e.addEventListener('paste', this._handlePaste, t.captureEvents),
        !1 !== t.scanButtonKeyCode &&
          e.addEventListener('keyup', this._handleKeyUp, t.captureEvents),
        (!0 !== t.reactToKeydown && !1 === t.scanButtonKeyCode) ||
          e.addEventListener('keydown', this._handleKeyDown, t.captureEvents),
        this
      );
    },
    detachFrom: function (e) {
      (e.scannerDetectionData.options.reactToPaste &&
        e.removeEventListener('paste', this._handlePaste),
        !1 !== e.scannerDetectionData.options.scanButtonKeyCode &&
          e.removeEventListener('keyup', this._handleKeyUp),
        e.removeEventListener('keydown', this._handleKeyDown),
        (e.scannerDetectionData = void 0));
    },
    getOptions: function (e) {
      return e.scannerDetectionData.options;
    },
    setOptions: function (e, t) {
      switch (e.scannerDetectionData.options.reactToPaste) {
        case !0:
          !1 === t.reactToPaste && e.removeEventListener('paste', this._handlePaste);
          break;
        case !1:
          !0 === t.reactToPaste && e.addEventListener('paste', this._handlePaste);
      }
      switch (e.scannerDetectionData.options.scanButtonKeyCode) {
        case !1:
          !1 !== t.scanButtonKeyCode && e.addEventListener('keyup', this._handleKeyUp);
          break;
        default:
          !1 === t.scanButtonKeyCode && e.removeEventListener('keyup', this._handleKeyUp);
      }
      return (
        (e.scannerDetectionData.options = this._mergeOptions(e.scannerDetectionData.options, t)),
        this._reinitialize(e),
        this
      );
    },
    decodeKeyEvent: function (e) {
      var t = this._getNormalizedKeyNum(e);
      switch (!0) {
        case 48 <= t && t <= 90:
        case 106 <= t && t <= 111:
          if (void 0 !== e.key && '' !== e.key) return e.key;
          var n = String.fromCharCode(t);
          switch (e.shiftKey) {
            case !1:
              n = n.toLowerCase();
              break;
            case !0:
              n = n.toUpperCase();
          }
          return n;
        case 96 <= t && t <= 105:
          return t - 96;
      }
      return '';
    },
    simulate: function (e, t) {
      return (
        this._reinitialize(e),
        Array.isArray(t)
          ? t.forEach(function (e) {
              var t = {};
              ('object' != typeof e && 'function' != typeof e) || null === e
                ? (t.keyCode = parseInt(e))
                : (t = e);
              var n = new KeyboardEvent('keydown', t);
              document.dispatchEvent(n);
            })
          : this._validateScanCode(e, t),
        this
      );
    },
    _reinitialize: function (e) {
      var t = e.scannerDetectionData.vars;
      ((t.firstCharTime = 0), (t.lastCharTime = 0), (t.accumulatedString = ''));
    },
    _isFocusOnIgnoredElement: function (e) {
      var t = e.scannerDetectionData.options.ignoreIfFocusOn;
      if (!t) return !1;
      var n = document.activeElement;
      if (Array.isArray(t)) {
        for (var a = 0; a < t.length; a++) if (!0 === n.matches(t[a])) return !0;
      } else if (n.matches(t)) return !0;
      return !1;
    },
    _validateScanCode: function (e, t) {
      var n,
        a = e.scannerDetectionData,
        i = a.options,
        o = a.options.singleScanQty,
        r = a.vars.firstCharTime,
        s = a.vars.lastCharTime,
        c = {};
      switch (!0) {
        case t.length < i.minLength:
          c = { message: 'Receieved code is shorter then minimal length' };
          break;
        case s - r > t.length * i.avgTimeByChar:
          c = { message: 'Receieved code was not entered in time' };
          break;
        default:
          return (
            i.onScan.call(e, t, o),
            (n = new CustomEvent('scan', { detail: { scanCode: t, qty: o } })),
            e.dispatchEvent(n),
            d._reinitialize(e),
            !0
          );
      }
      return (
        (c.scanCode = t),
        (c.scanDuration = s - r),
        (c.avgTimeByChar = i.avgTimeByChar),
        (c.minLength = i.minLength),
        i.onScanError.call(e, c),
        (n = new CustomEvent('scanError', { detail: c })),
        e.dispatchEvent(n),
        d._reinitialize(e),
        !1
      );
    },
    _mergeOptions: function (e, t) {
      var n,
        a = {};
      for (n in e) Object.prototype.hasOwnProperty.call(e, n) && (a[n] = e[n]);
      for (n in t) Object.prototype.hasOwnProperty.call(t, n) && (a[n] = t[n]);
      return a;
    },
    _getNormalizedKeyNum: function (e) {
      return e.which || e.keyCode;
    },
    _handleKeyDown: function (e) {
      var t = d._getNormalizedKeyNum(e),
        n = this.scannerDetectionData.options,
        a = this.scannerDetectionData.vars,
        i = !1;
      if (!1 !== n.onKeyDetect.call(this, t, e) && !d._isFocusOnIgnoredElement(this))
        if (!1 === n.scanButtonKeyCode || t != n.scanButtonKeyCode) {
          switch (!0) {
            case a.firstCharTime && -1 !== n.suffixKeyCodes.indexOf(t):
              (e.preventDefault(), e.stopImmediatePropagation(), (i = !0));
              break;
            case !a.firstCharTime && -1 !== n.prefixKeyCodes.indexOf(t):
              (e.preventDefault(), e.stopImmediatePropagation(), (i = !1));
              break;
            default:
              var o = n.keyCodeMapper.call(this, e);
              if (null === o) return;
              ((a.accumulatedString += o),
                n.preventDefault && e.preventDefault(),
                n.stopPropagation && e.stopImmediatePropagation(),
                (i = !1));
          }
          (a.firstCharTime || (a.firstCharTime = Date.now()),
            (a.lastCharTime = Date.now()),
            a.testTimer && clearTimeout(a.testTimer),
            i
              ? (d._validateScanCode(this, a.accumulatedString), (a.testTimer = !1))
              : (a.testTimer = setTimeout(
                  d._validateScanCode,
                  n.timeBeforeScanTest,
                  this,
                  a.accumulatedString,
                )),
            n.onKeyProcess.call(this, o, e));
        } else
          a.longPressed ||
            ((a.longPressTimer = setTimeout(
              n.onScanButtonLongPress,
              n.scanButtonLongPressTime,
              this,
            )),
            (a.longPressed = !0));
    },
    _handlePaste: function (e) {
      if (!d._isFocusOnIgnoredElement(this)) {
        (e.preventDefault(), oOptions.stopPropagation && e.stopImmediatePropagation());
        var t = (event.clipboardData || window.clipboardData).getData('text');
        this.scannerDetectionData.options.onPaste.call(this, t, event);
        var n = this.scannerDetectionData.vars;
        ((n.firstCharTime = 0), (n.lastCharTime = 0), d._validateScanCode(this, t));
      }
    },
    _handleKeyUp: function (e) {
      d._isFocusOnIgnoredElement(this) ||
        (d._getNormalizedKeyNum(e) == this.scannerDetectionData.options.scanButtonKeyCode &&
          (clearTimeout(this.scannerDetectionData.vars.longPressTimer),
          (this.scannerDetectionData.vars.longPressed = !1)));
    },
    isScanInProgressFor: function (e) {
      return 0 < e.scannerDetectionData.vars.firstCharTime;
    },
  };
  return d;
});
// =============================================================================
// POS AWESOME TRANSLATION SYSTEM
// =============================================================================

// Translation data
const posaTranslations = {
  ar: {
    Account: 'الحساب',
    'Account Head': 'رئيس الحسابات',
    'Accounts Manager': 'مدير الحسابات',
    'Accounts User': 'مستخدم الحسابات',
    'Additional Notes': 'ملاحظات إضافية',
    Administrator: 'مدير النظام',
    'Allow Create Sales Order': 'السماح بإنشاء أمر مبيعات',
    'Allow Credit Sale': 'السماح بالبيع بالائتمان',
    'Allow Partial Payment': 'السماح بالدفع الجزئي',
    'Allow Return': 'السماح بالإرجاع',
    'Allow Submissions in background job': 'السماح بإرسال الطلبات في مهمة خلفية',
    'Allow User to Edit Item Discount': 'السماح للمستخدم بتعديل خصم الصنف',
    'Allow user to edit Invoice_discount': 'السماح للمستخدم بتعديل الخصم الإضافي',
    'Allow user to edit Rate': 'السماح للمستخدم بتعديل السعر',
    'Amended From': 'معدل من',
    Amount: 'المبلغ',
    'Apply Customer Discount': 'تطبيق خصم العميل',
    'Apply For': 'التقديم لـ',
    'Apply On': 'يطبق على',
    'Apply Rule On Brand': 'تطبيق القاعدة على العلامة التجارية',
    'Apply Rule On Item Code': 'تطبيق القاعدة على كود الصنف',
    'Apply Rule On Item Group': 'تطبيق القاعدة على مجموعة الأصناف',
    'Apply Type': 'نوع التطبيق',
    'Auto Apply': 'تطبيق تلقائي',
    'Auto Delete Draft Invoice': 'حذف الفاتورة المسودة تلقائيًا',
    'Allow Delete Offline Invoice': 'السماح بحذف الفاتورة في وضع عدم الاتصال',
    'Auto Set Batch': 'تعيين الدفعة تلقائيًا',
    'Allow Price List Rate Change': 'السماح بتغيير سعر قائمة الأسعار',
    'List Rate': 'قائمة الأسعار',
    Brand: 'العلامة التجارية',
    Cancelled: 'ملغاة',
    'Cash Mode of Payment': 'طريقة الدفع نقدًا',
    Cashier: 'أمين الصندوق',
    Closed: 'مغلقة',
    'Closing Amount': 'مبلغ الإقفال',
    Company: 'الشركة',
    Customer: 'العميل',
    Date: 'التاريخ',
    'Default Loyalty Program': 'برنامج المكافآت الافتراضي',
    'Delivery Date': 'تاريخ التسليم',
    Description: 'الوصف',
    Details: 'التفاصيل',
    Difference: 'الفرق',
    Disable: 'تعطيل',
    'Discount %': 'نسبة الخصم ٪',
    'Discount Amount': 'قيمة الخصم',
    'Discount Percentage': 'نسبة الخصم',
    'Discount Type': 'نوع الخصم',
    Draft: 'مسودة',
    'Expected Amount': 'المبلغ المتوقع',
    'For POS Closing Shift Payment Reconciliation': 'للمطابقة بين المدفوعات عند إقفال نقطة البيع',
    'Give Item': 'الصنف الممنوح',
    'Give Item Row ID': 'معرّف صف الصنف الممنوح',
    'Give Product': 'المنتج الممنوح',
    'Given Quantity': 'الكمية الممنوحة',
    'Grand Total': 'الإجمالي الكلي',
    'Hide Close Shift': 'إخفاء إقفال الوردية',
    'Hide Unavailable Items': 'إخفاء الأصناف غير المتوفرة',
    'Hide Variants Items': 'إخفاء أصناف المتغيرات',
    'Invalid Period': 'فترة غير صالحة',
    'Is Offer': 'هو عرض',
    'Is Offer Replace For item Row ID': 'هل العرض لاستبدال معرّف صف الصنف',
    'It is best not to use more than four numbers': 'يفضل عدم استخدام أكثر من أربعة أرقام',
    'Item Code': 'كود الصنف',
    'Items Group': 'مجموعة الأصناف',
    'Item Price': 'سعر الصنف',
    'Item Rate Should Less Then': 'يجب أن يكون سعر الصنف أقل من',
    Items: 'الأصناف',
    'Linked Invoices': 'الفواتير المرتبطة',
    'Loyalty Point': 'نقطة مكافأة',
    'Loyalty Point Scheme': 'برنامج المكافآت',
    'Loyalty Points': 'نقاط المكافآت',
    'Max Amount': 'الحد الأقصى للمبلغ',
    'Max Discount Percentage Allowed ': 'الحد الأقصى المسموح به لنسبة الخصم',
    'Max Quantity': 'الحد الأقصى للكمية',
    'Min Amount': 'الحد الأدنى للمبلغ',
    'Min Quantity': 'الحد الأدنى للكمية',
    'Mode of Payment': 'طريقة الدفع',
    'Mode of Payments': 'طرق الدفع',
    'Modes of Payment': 'طرق الدفع',
    'Net Total': 'صافي الإجمالي',
    Offer: 'العرض',
    'Offer Applied': 'تم تطبيق العرض',
    'Offer Name': 'اسم العرض',
    Open: 'مفتوحة',
    'Opening Amount': 'مبلغ الافتتاح',
    'Opening Balance Details': 'تفاصيل الرصيد الافتتاحي',
    'POS Awesome Advance Settings': 'إعدادات نقاط البيع أوسم المتقدمة',
    'POS Awesome Settings': 'إعدادات نقاط البيع أوسم',
    'POS Closing Shift': 'إقفال وردية نقطة البيع',
    'POS Closing Shift Detail': 'تفاصيل إقفال وردية نقطة البيع',
    'POS Closing Shift Taxes': 'ضرائب إقفال وردية نقطة البيع',
    'POS Closing Shift {} against {} between selected period':
      'إقفال وردية نقطة البيع {} مقابل {} خلال الفترة المحددة',
    'POS Offer': 'عرض نقطة البيع',
    'POS Offer Detail': 'تفاصيل عرض نقطة البيع',
    'POS Offers': 'عروض نقطة البيع',
    'POS Offers Detail': 'تفاصيل عروض نقطة البيع',
    'POS Opening Shift': 'وردية فتح نقطة البيع',
    'POS Opening Shift Detail': 'تفاصيل وردية فتح نقطة البيع',
    'POS Profile': 'ملف تعريف نقطة البيع',
    'POS Profile {} does not belongs to company {}':
      'ملف تعريف نقطة البيع {} لا ينتمي إلى الشركة {}',
    'POS Shift': 'وردية نقطة البيع',
    'POS Transactions': 'معاملات نقطة البيع',
    'Payment Reconciliation': 'تسوية المدفوعات',
    'Period End Date': 'تاريخ نهاية الفترة',
    'Period Start Date': 'تاريخ بداية الفترة',
    'Posting Date': 'تاريخ النشر',
    Price: 'السعر',
    'Price Discount Scheme ': 'مخطط خصم السعر',
    Printed: 'مطبوعة',
    'Product Discount Scheme': 'مخطط خصم المنتج',
    'Promo Type': 'نوع الترويج',
    'Qualifying Transaction / Item': 'معاملة / صنف مؤهل',
    'Quantity and Amount Conditions': 'شروط الكمية والمبلغ',
    Rate: 'المعدل',
    'Replace Cheapest Item': 'استبدال أرخص صنف',
    'Replace Same Item': 'استبدال نفس الصنف',
    'Row ID': 'معرّف الصف',
    'Sales Invoice': 'فاتورة مبيعات',
    'Sales Invoice Reference': 'مرجع فاتورة المبيعات',
    'Sales Manager': 'مدير المبيعات',
    'Sales Master Manager': 'مدير المبيعات الرئيسي',
    'Sales Summary': 'ملخص المبيعات',
    'Sales User': 'مستخدم المبيعات',
    'Scale Barcode Start With': 'يبدأ باركود الميزان بـ',
    'Search by Serial Number': 'البحث حسب الرقم التسلسلي',
    'Selected POS Opening Shift should be open.': 'يجب أن تكون وردية فتح نقطة البيع المحددة مفتوحة',
    'Send invoice to submit after printing': 'إرسال الفاتورة للإعتماد بعد الطباعة',
    'Set Posting Date': 'تعيين تاريخ النشر',
    'Show Template Items': 'عرض أصناف القوالب',
    Status: 'الحالة',
    'Status must be one of {0}': 'يجب أن تكون الحالة واحدة من {0}',
    'System Manager': 'مدير النظام',
    Taxes: 'الضرائب',
    'This invoice {0} cannot be deleted': 'لا يمكن حذف الفاتورة {0}',
    'Invoice {0} Deleted': 'تم حذف الفاتورة {0}',
    Title: 'العنوان',
    'Total Quantity': 'إجمالي الكمية',
    Transaction: 'المعاملة',
    UOM: 'وحدة',
    'Use Browser Local Storage': 'استخدام التخزين المحلي للمتصفح',
    'Fetch Items Directly from Server': 'جلب الأصناف مباشرة من الخادم',
    'Use Cashback': 'استخدام الاسترداد النقدي',
    'Use Customer Credit': 'استخدام رصيد العميل',
    'User {} has been disabled. Please select valid user/cashier':
      'تم تعطيل المستخدم {}. يرجى اختيار مستخدم/أمين صندوق صالح',
    'Valid From': 'صالح من',
    'Valid Upto': 'صالح حتى',
    Warehouse: 'المستودع',
    Type: 'النوع',
    'Available QTY': 'الكمية المتاحة',
    'Create Only Sales Order': 'إنشاء أوامر مبيعات فقط',
    'Search Items': 'البحث عن الأصناف',
    'Scan with Camera': 'المسح بالكاميرا',
    Settings: 'الإعدادات',
    'Reload Items': 'إعادة تحميل الأصناف',
    'Hide quantity decimals': 'إخفاء عشريات الكمية',
    'Always fetch items from server': 'جلب الأصناف دائماً من الخادم',
    Cancel: 'إلغاء',
    'Change Language': 'تغيير اللغة',
    Close: 'إغلاق',
    'Language will be changed to': 'سيتم تغيير اللغة إلى',
    Apply: 'تطبيق',
    Clear: 'مسح',
    Back: 'رجوع',
    Select: 'اختيار',
    Search: 'بحث',
    'Yes, Cancel sale': 'نعم، إلغاء البيع',
    'Cancel Sale': 'إلغاء البيع',
    'No Item has this barcode': 'لا يوجد صنف بهذا الباركود',
    'Item not found': 'الصنف غير موجود',
    'No invoices found. Try different search criteria.':
      'لم يتم العثور على فواتير. جرب معايير بحث مختلفة',
    'No camera found on this device.': 'لم يتم العثور على كاميرا في هذا الجهاز',
    'Camera access is required to scan barcodes.': 'مطلوب الوصول للكاميرا لمسح الباركود',
    'Select a customer to use coupon': 'اختر عميلاً لاستخدام الكوبون',
    'Customer Name': 'اسم العميل',
    'Customer ID': 'معرف العميل',
    'Mobile Number': 'رقم الهاتف المحمول',
    'Tax ID': 'الرقم الضريبي',
    City: 'المدينة',
    Country: 'البلد',
    'Email Id': 'البريد الإلكتروني',
    Gender: 'النوع',
    'Referral Code': 'كود الإحالة',
    'Mobile No': 'رقم الهاتف',
    'Address Line 1': 'العنوان السطر 1',
    Columns: 'الأعمدة',
    Name: 'الاسم',
    QTY: 'الكمية',
    Invoice_discount: 'خصم إضافي',
    'Items Discounts': 'خصومات الأصناف',
    Total: 'الإجمالي',
    'Save & Clear': 'حفظ ومسح',
    'Load Drafts': 'تحميل المسودات',
    PAY: 'دفع',
    'Sales Return': 'مرتجع مبيعات',
    'Paid Amount': 'المبلغ المدفوع',
    'Paid Change': 'الباقي المدفوع',
    'Credit Change': 'الباقي الائتماني',
    'Tax and Charges': 'الضرائب والرسوم',
    'Total Amount': 'إجمالي المبلغ',
    'Rounded Total': 'الإجمالي المدور',
    'Get Payments': 'الحصول على المدفوعات',
    Request: 'طلب',
    Submit: 'إرسال',
    'Submit & Print': 'إرسال وطباعة',
    'Cancel Payment': 'إلغاء الدفع',
    Closing: 'الإقفال',
    Menu: 'القائمة',
    Actions: 'الإجراءات',
    'Close Shift': 'إغلاق الوردية',
    'Print Last Invoice': 'طباعة آخر فاتورة',
    'Sync Offline Invoices': 'مزامنة الفواتير غير المتصلة',
    'Go Online/Offline': 'الاتصال/عدم الاتصال',
    'Clear Cache': 'مسح التخزين المؤقت',
    About: 'عن النظام',
    'Light/Dark Mode': 'الوضع الفاتح/الداكن',
    Logout: 'تسجيل الخروج',
    'Select Language': 'اختيار اللغة',
    'Item Selector Settings': 'إعدادات محدد الأصناف',
    'Hide zero rated items': 'إخفاء الأصناف ذات السعر صفر',
    'Custom items per page': 'عدد مخصص من الأصناف لكل صفحة',
    'Always fetch items from server (ignore local cache)':
      'جلب الأصناف دائماً من الخادم (تجاهل التخزين المحلي)',
    'POS Awesome': 'نقاط البيع',
    'Select S.O': 'اختر أمر البيع',
    Offers: 'عروض',
    Coupons: 'كوبونات',
    ms: 'مللي ثانية',
    MB: 'ميجابايت',
    'Connected to Server': 'متصل بالخادم',
    'To Sync': 'بانتظار المزامنة',
    Synced: 'تمت المزامنة',
    POS: 'نقاط البيع',
    Awesome: 'الرائع',
    'No items found': 'لم يتم العثور على أصناف',
    'No items in cart': 'لا توجد أصناف في السلة',
    'Customers not found': 'لم يتم العثور على عملاء',
    'Charges not found': 'لم يتم العثور على رسوم',
    'Address not found': 'لم يتم العثور على عنوان',
    'Sales Person not found': 'لم يتم العثور على مندوب المبيعات',
    'Group not found': 'لم يتم العثور على مجموعة',
    'Territory not found': 'لم يتم العثور على منطقة',
    'Total Outstanding': 'إجمالي المستحق',
    'Total Unallocated': 'إجمالي غير المخصص',
    Action: 'إجراء',
    'Add New Address': 'إضافة عنوان جديد',
    'Add/Edit Coupon Conditions': 'إضافة/تعديل شروط القسيمة',
    'All Caught Up!': 'أنت على اطلاع كامل!',
    'All Synced': 'تمت المزامنة بالكامل',
    'App information': 'معلومات التطبيق',
    Applied: 'تم التطبيق',
    Apps: 'التطبيقات',
    'Are you sure you want to close? All entered data will be lost.':
      'هل أنت متأكد أنك تريد الإغلاق؟ سيتم فقدان جميع البيانات المدخلة.',
    Available: 'المتوفر',
    'Balance will be updated when connection is restored': 'سيتم تحديث الرصيد عند استعادة الاتصال',
    'Basic Information': 'المعلومات الأساسية',
    'Batch Information': 'معلومات الدفعة',
    Breakdown: 'تفصيل',
    'Built with Frappe': 'تم تطويره باستخدام Frappe',
    'CPU Cores': 'عدد أنوية المعالج',
    'CPU Load': 'استخدام المعالج',
    'Cache Usage': 'استخدام الذاكرة المخبأة',
    'Cache cleared successfully': 'تم مسح الذاكرة المخبأة بنجاح',
    Calculating: 'جارٍ الحساب',
    'Camera Access Required': 'يتطلب الوصول إلى الكاميرا',
    'Camera access aborted.': 'تم إلغاء الوصول إلى الكاميرا.',
    'Camera permission denied. Please allow camera access in your browser settings.':
      'تم رفض إذن الكاميرا. يرجى السماح بالوصول إلى الكاميرا من إعدادات المتصفح.',
    'Cannot Save Offline Invoice': 'لا يمكن حفظ الفاتورة في وضع عدم الاتصال',
    'Cannot Save Offline Payment': 'لا يمكن حفظ الدفع في وضع عدم الاتصال',
    'Cannot clear cache while offline': 'لا يمكن مسح الذاكرة المخبأة في وضع عدم الاتصال',
    Card: 'بطاقة',
    'Change Price': 'تغيير السعر',
    'Change interface language': 'تغيير لغة الواجهة',
    'Choose your preferred language for the POS interface': 'اختر لغتك المفضلة لواجهة نقاط البيع',
    'Click to refresh': 'انقر للتحديث',
    'Client CPU Lag': 'تأخير المعالج لدى العميل',
    'Client Memory Usage': 'استخدام ذاكرة العميل',
    'Client Metrics': 'إحصائيات العميل',
    'Close Scanner': 'إغلاق الماسح',
    'Closing POS Shift': 'إغلاق وردية نقاط البيع',
    Code: 'الرمز',
    'Code scanned successfully': 'تم مسح الرمز بنجاح',
    'Confirm Close': 'تأكيد الإغلاق',
    'Confirm Mobile Number': 'تأكيد رقم الجوال',
    Connections: 'الاتصالات',
    'Continue Editing': 'متابعة التعديل',
    'Could not fetch latest balance from server': 'تعذر جلب الرصيد الأخير من الخادم',
    Coupon: 'قسيمة',
    'Create Customer': 'إنشاء عميل',
    'Create POS Opening Shift': 'إنشاء وردية فتح نقاط البيع',
    'Current Event Loop Lag': 'تأخير دورة الأحداث الحالية',
    'Custom Due Days': 'أيام استحقاق مخصصة',
    'Customer Balance': 'رصيد العميل',
    'Customer Name is required': 'اسم العميل مطلوب',
    'Customer balance unavailable offline': 'رصيد العميل غير متاح في وضع عدم الاتصال',
    'Customer created successfully.': 'تم إنشاء العميل بنجاح.',
    'Customer creation failed.': 'فشل إنشاء العميل.',
    'Customer group is required': 'مجموعة العملاء مطلوبة',
    'Customer saved offline': 'تم حفظ العميل في وضع عدم الاتصال',
    'Customer territory is required': 'منطقة العميل مطلوبة',
    'Customer updated successfully.': 'تم تحديث العميل بنجاح.',
    'Dark Mode': 'الوضع الداكن',
    'Database Health': 'صحة قاعدة البيانات',
    'Database Info': 'معلومات قاعدة البيانات',
    'Database health affects overall system speed and reliability.':
      'صحة قاعدة البيانات تؤثر على سرعة النظام وموثوقيته.',
    Decrease: 'إنقاص',
    'Delete Invoice': 'حذف الفاتورة',
    'Delivery Information': 'معلومات التسليم',
    'Detecting formats': 'جارٍ اكتشاف التنسيقات',
    'Device Memory': 'ذاكرة الجهاز',
    'Disable offline mode': 'تعطيل وضع عدم الاتصال',
    'Due Date': 'تاريخ الاستحقاق',
    'End current session': 'إنهاء الجلسة الحالية',
    'Error Loading Data': 'خطأ في تحميل البيانات',
    'Error accessing camera': 'خطأ في الوصول إلى الكاميرا',
    'Error adding offer to items': 'خطأ في إضافة العرض إلى العناصر',
    'Error calculating prices': 'خطأ في حساب الأسعار',
    'Error deleting offer from items': 'خطأ في حذف العرض من العناصر',
    'Error fetching customer balance': 'خطأ في جلب رصيد العميل',
    'Error loading currencies': 'خطأ في تحميل العملات',
    'Error processing payment': 'خطأ في معالجة الدفع',
    'Error removing price offer': 'خطأ في إزالة عرض السعر',
    'Error searching invoices': 'خطأ في البحث عن الفواتير',
    'Error submitting invoice': 'خطأ في إرسال الفاتورة',
    'Error submitting invoice No response from server':
      'خطأ في إرسال الفاتورة لا يوجد استجابة من الخادم',
    'Error toggling item details': 'خطأ في تبديل تفاصيل العنصر',
    'Error updating item details': 'خطأ في تحديث تفاصيل العنصر',
    'Event-loop lag measures how busy your browser is. Lower is better.':
      'Event-loop lag measures how busy your browser is. Lower is better.',
    'Failed to clear cache': 'فشل في مسح الذاكرة المخبأة',
    'Failed to load items. Please try again.': 'فشل تحميل العناصر. يرجى المحاولة مرة أخرى.',
    'Fixing payment amounts for return invoice': 'تصحيح مبالغ الدفع لفاتورة الإرجاع',
    'Flash Off': 'إيقاف الفلاش',
    'Flash On': 'تشغيل الفلاش',
    'Full Name': 'الاسم الكامل',
    'Go Offline': 'الانتقال إلى وضع عدم الاتصال',
    'Go Online': 'الاتصال بالإنترنت',
    'Hide Non Essential Fields': 'إخفاء الحقول غير الأساسية',
    Increase: 'زيادة',
    IndexedDB: 'IndexedDB',
    'Initialize your shift with opening balances': 'ابدأ ورديتك بالأرصدة الافتتاحية',
    'Installed Applications': 'التطبيقات المثبتة',
    'Invalid closing amount': 'مبلغ إغلاق غير صالح',
    Invoice: 'فاتورة',
    'Invoice saved offline': 'تم حفظ الفاتورة في وضع عدم الاتصال',
    Invoices: 'الفواتير',
    Item: 'عنصر',
    'Item order updated': 'تم تحديث ترتيب العناصر',
    'Item price updated': 'تم تحديث سعر العنصر',
    'Items per page': 'عدد العناصر لكل صفحة',
    Language: 'اللغة',
    'Light Mode': 'الوضع الفاتح',
    'Load More Invoices': 'تحميل المزيد من الفواتير',
    'Load Sales Invoice': 'تحميل فاتورة المبيعات',
    'Load previously saved invoices': 'تحميل الفواتير المحفوظة مسبقًا',
    'Loading cache': 'جارٍ تحميل الذاكرة المخبأة',
    'Loading database stats': 'جارٍ تحميل إحصائيات قاعدة البيانات',
    'Loading server CPU/memory usage': 'جارٍ تحميل استخدام المعالج/الذاكرة للخادم',
    Loading: 'جارٍ التحميل',
    'Loyalty Point Offer Applied': 'تم تطبيق عرض نقاط المكافأة',
    'Manage your offline transactions': 'إدارة معاملاتك في وضع عدم الاتصال',
    Mode: 'الوضع',
    'Multiple Items Found': 'تم العثور على عناصر متعددة',
    'Negative values not allowed': 'القيم السالبة غير مسموح بها',
    'New Offer Available': 'عرض جديد متاح',
    'New Price List Rate': 'سعر قائمة جديد',
    'No invoices found': 'لم يتم العثور على فواتير',
    'No offline invoices pending synchronization': 'لا توجد فواتير غير متصلة بانتظار المزامنة',
    'Nobile Number': 'رقم الجوال',
    'Offline Invoices': 'الفواتير في وضع عدم الاتصال',
    Order: 'طلب',
    Outstanding: 'مستحق',
    Paid: 'مدفوع',
    'Payment ID': 'معرّف الدفع',
    'Payment Methods': 'طرق الدفع',
    'Payment Request took too long to respond. Please try requesting for payment again':
      'استغرق طلب الدفع وقتًا طويلاً للاستجابة. يرجى إعادة المحاولة.',
    'Payment name not found. Cannot open print view.':
      'لم يتم العثور على اسم الدفع. لا يمكن فتح عرض الطباعة.',
    'Payment request failed': 'فشل طلب الدفع',
    'Payment saved offline': 'تم حفظ الدفع في وضع عدم الاتصال',
    'Payment submitted but print function could not be executed. Payment name not found.':
      'تم إرسال الدفع ولكن لم يتم تنفيذ الطباعة. لم يتم العثور على اسم الدفع.',
    Payments: 'المدفوعات',
    'Peak Memory': 'أقصى استخدام للذاكرة',
    'Peak Server': 'أقصى استخدام للخادم',
    Peak: 'الذروة',
    Pending: 'قيد الانتظار',
    'Pending Invoices': 'الفواتير المعلقة',
    'Please allow camera access to scan codes': 'يرجى السماح بالوصول إلى الكاميرا لمسح الرموز',
    'Please configure a POS Profile first': 'يرجى إعداد ملف تعريف نقاط البيع أولاً',
    'Please make a payment or select an payment': 'يرجى إجراء الدفع أو اختيار وسيلة دفع',
    'Please request phone payment or use another payment method':
      'يرجى طلب الدفع عبر الهاتف أو استخدام طريقة دفع أخرى',
    'Please select a customer': 'يرجى اختيار عميل',
    'Please select a customer first': 'يرجى اختيار العميل أولاً',
    'Please select an invoice': 'يرجى اختيار فاتورة',
    "Please set the customer's mobile number": 'يرجى إدخال رقم جوال العميل',
    'Position the QR code or barcode within the scanning area':
      'ضع رمز QR أو الباركود داخل منطقة المسح',
    'Pricing & Discounts': 'التسعير والخصومات',
    'Print Draft': 'طباعة المسودة',
    'Processing Payment': 'جارٍ معالجة الدفع',
    'Quick Actions': 'إجراءات سريعة',
    'Reconcile payment methods and close shift': 'تسوية طرق الدفع وإغلاق الوردية',
    Remove: 'إزالة',
    'Remove local data and refresh': 'إزالة البيانات المحلية وتحديث',
    'Reprint previous transaction': 'إعادة طباعة المعاملة السابقة',
    'Required columns cannot be hidden': 'لا يمكن إخفاء الأعمدة المطلوبة',
    Retry: 'إعادة المحاولة',
    'Return without Invoice': 'إرجاع بدون فاتورة',
    Rows: 'الصفوف',
    'Scan QR Code/Barcode': 'مسح رمز QR/الباركود',
    'Search Mpesa Payments': 'بحث مدفوعات Mpesa',
    'Secure context (HTTPS) required for camera access.':
      'يتطلب الوصول إلى الكاميرا سياق آمن (HTTPS).',
    'Select Columns to Display': 'اختر الأعمدة لعرضها',
    'Select Payment': 'اختر الدفع',
    'Select Return Invoice': 'اختر فاتورة الإرجاع',
    'Select Sales Orders': 'اختر أوامر المبيعات',
    'Serial Numbers': 'الأرقام التسلسلية',
    'Server CPU Usage': 'استخدام المعالج للخادم',
    'Server Health': 'صحة الخادم',
    'Server Memory Usage': 'استخدام ذاكرة الخادم',
    'Server Metrics': 'إحصائيات الخادم',
    'Server Uptime': 'مدة تشغيل الخادم',
    'Sign out of session': 'تسجيل الخروج من الجلسة',
    Size: 'الحجم',
    'Slow Queries': 'الاستعلامات البطيئة',
    'Stock Information': 'معلومات المخزون',
    'STOCK UOM': 'وحدة قياس المخزون',
    'Successfully scanned': 'تم المسح بنجاح',
    'Switch Camera': 'تبديل الكاميرا',
    'Switch theme appearance': 'تبديل مظهر السمة',
    'Switched to': 'تم التبديل إلى',
    'Sync All': 'مزامنة الكل',
    'System Information': 'معلومات النظام',
    Tables: 'الجداول',
    'The app stores data locally for offline use. This is called cache.':
      'يقوم التطبيق بتخزين البيانات محليًا للاستخدام في وضع عدم الاتصال. يُعرف ذلك بالذاكرة المخبأة.',
    'These invoices will be synced when connection is restored':
      'سيتم مزامنة هذه الفواتير عند استعادة الاتصال',
    'This coupon already used !': 'تم استخدام هذه القسيمة بالفعل!',
    'This is an item template. Please choose a variant.': 'هذا قالب عنصر. يرجى اختيار متغير.',
    Time: 'الوقت',
    'Tip Clear cache regularly to free up space and keep the app fast.':
      'نصيحة امسح الذاكرة المخبأة بانتظام لتوفير المساحة والحفاظ على سرعة التطبيق.',
    'Tip Close unused tabs or apps to reduce lag.':
      'نصيحة أغلق علامات التبويب أو التطبيقات غير المستخدمة لتقليل التأخير.',
    'Tip Monitor slow queries and table size for optimal performance.':
      'نصيحة راقب الاستعلامات البطيئة وحجم الجداول للحصول على أداء مثالي.',
    'Top Tables': 'أعلى الجداول',
    'Total Invoices': 'إجمالي الفواتير',
    'Total Mpesa': 'إجمالي Mpesa',
    'Total Payments': 'إجمالي المدفوعات',
    'Total Selected ': 'الإجمالي المحدد',
    'Total Size': 'إجمالي الحجم',
    'UOM not found': 'لم يتم العثور على وحدة القياس',
    Unallocated: 'غير مخصص',
    'Unknown error': 'خطأ غير معروف',
    Update: 'تحديث',
    'Update Customer': 'تحديث العميل',
    'Updates automatically': 'يتم التحديث تلقائيًا',
    'Upload pending transactions': 'تحميل المعاملات المعلقة',
    Usage: 'الاستخدام',
    'Usage Stats': 'إحصائيات الاستخدام',
    'Use date range to search for older invoices': 'استخدم نطاق التاريخ للبحث عن الفواتير القديمة',
    Used: 'المستخدم',
    'Using cached customer balance': 'استخدام رصيد العميل من الذاكرة المخبأة',
    'Verify closing amounts for each payment method': 'تحقق من مبالغ الإغلاق لكل طريقة دفع',
    'Waiting for payment': 'في انتظار الدفع',
    'Warning High cache usage may affect performance.':
      'تحذير الاستخدام العالي للذاكرة المخبأة قد يؤثر على الأداء.',
    'Warning High lag may indicate heavy processing or browser slowness.':
      'تحذير التأخير العالي قد يشير إلى معالجة ثقيلة أو بطء في المتصفح.',
    'Work without server connection': 'العمل بدون اتصال بالخادم',
    'Yes, Cancel sale': 'نعم، ألغِ البيع',
    'Yes, Close': 'نعم، إغلاق',
    add: 'إضافة',
    localStorage: 'التخزين المحلي',
    Card: 'كبطاقات',
    List: 'كقائمة',
    'Setup complete!': 'اكتمل الإعداد',
    'Ready!': 'جاهز',
    'Loading app data...': 'جارٍ تحميل بيانات التطبيق...',
    'Taking longer than expected...': 'يستغرق وقتًا أطول من المتوقع...',
    'Initializing application...': 'جارٍ تهيئة التطبيق...',
    'Loading product catalog...': 'جارٍ تحميل كتالوج المنتجات...',
    'Loading customer database...': 'جارٍ تحميل قاعدة بيانات العملاء...',
    'Cannot change language - same language selected': 'لا يمكن تغيير اللغة - تم تحديد نفس اللغة',
    'Language changed successfully! Reloading...': 'تم تغيير اللغة بنجاح جارٍ إعادة التحميل',
    'Failed to change language': 'فشل في تغيير اللغة',
    'his item': 'هذا الصنف',
    '{0} has only {1} in stock. You requested {2}. Adjust quantity or restock.':
      '{0} لديه {1} فقط في المخزون. لقد طلبت {2}. يرجى تعديل الكمية أو إعادة التخزين.',
    'Stock update: {0} has {1} available. Adding {2} will bring the stock below zero.':
      'تحديث المخزون: {0} لديه {1} متاح. إضافة {2} ستؤدي إلى رصيد سالب.',
    'POS Awesome': 'نقاط البيع المميزة',
    List: 'قائمة',
    Images: 'صور',
    Offers: 'العروض',
    Applied: 'مطبق',
    Qty: 'الكمية',
    'Close Shift': 'غلق الوردية',
    'Print Last Receipt': 'طباعة اخر فاتورة',
    Logout: 'خروج من النظام',
    About: 'عن',
    Invoices: 'الفواتير',
    Payments: 'المدفوعات',
    'UnAllocated Payments': 'المدفوعات غير المخصصة',
    'Search MPESA Payments': 'بحث عن مدفوعات موبايل',
    Search: 'بحث',
    Submit: 'تسجيل',
    'Select Shift': 'اختار الوردية',
    'Outstanding Amounts': 'إجمالي المبالغ المستحقة',
    'Selected Total :': 'إجمالي المحدد :',
    'Total Outstanding Amounts': 'إجمالي المبالغ المستحقة',
    'Total Selected :': 'إجمالي المحدد :',
    'Unallocated Payments': 'المدفوعات غير المخصصة',
    'Search for Mobile Payments': 'بحث عن مدفوعات موبايل',
    'Remaining Amount': 'المبلغ المتبقي',
    'Change Amount': 'المبلغ المرتجع',
    Get: 'الحصول على',
    Request: 'طلب',
    'Pay from Customer Points': 'دفع من نقاط العميل',
    'Customer Points Balance': 'رصيد نقاط العميل',
    'Customer Credit Redeemed': 'رصيد العميل المسترد',
    'Cash Credit Balance': 'رصيد ائتماني نقدي',
    'Net Total (Without Tax)': 'الصافي بدون ضريبة',
    Tax: 'الضريبة',
    'Total Before Discount': 'الإجمالي قبل الخصم',
    'Total Discount': 'إجمالي الخصم',
    'Invoice Total': 'إجمالي الفاتورة',
    'Rounded Total': 'الإجمالي المقرب',
    'Purchase Order Number': 'رقم طلب الشراء',
    'Purchase Order Date': 'تاريخ طلب الشراء',
    'Is Write Off Amount?': 'هل مبلغ مشطوب',
    'Is Credit Sale?': 'هل بيع بالاجل',
    'Is Cash Return?': 'هل هو استرداد نقدي؟',
    'Due Date': 'تاريخ الاستحقاق',
    'Use Customer Credit': 'استخدام رصيد العميل',
    'Available Credit': 'الرصيد المتاح',
    'Credit to Redeem': 'استرداد الرصيد',
    'Sales Person': 'مندوب البيع',
    'Sales Person not found': 'مندوب البيع غير موجود',
    'Payment Number': 'رقم الدفع',
    'Full Name': 'الاسم الكامل',
    'Phone Number': 'رقم الهاتف',
    'Please select a customer': 'برجاء اختيار عميل',
    'Please make a payment or select a payment': 'برجاء إجراء دفعة أو اختيار دفعة',
    'Please select an invoice': 'برجاء اختيار فاتورة',
    'Processing payment': 'جاري معالجة الدفع',
    'Item Name': 'اسم الصنف',
    Code: 'الرمز',
    Price: 'السعر',
    'Available Quantity': 'الكمية المتاحة',
    'Unit of Measure': 'وحدة القياس',
    Unit: 'الوحدة',
    Discount: 'خصم',
    'Another offer currently applied': 'عرض آخر مطبق حالياً',
    Company: 'الشركة',
    'POS Profile': 'ملف نقاط البيع',
    'Edit Price': 'تعديل السعر',
    'Mode of Payment': 'طريقة الدفع',
    'Opening Amount': 'المبلغ الافتتاحي',
    'Close Cashier Shift': 'اغلاق وردية الكاشير',
    'Edit Amount': 'تعديل المبلغ',
    Close: 'إغلاق',
    'Expected Total': 'الإجمالي المتوقع',
    'Closing Total': 'اجمالي الاغلاق',
    'Add New Address': 'إضافة عنوان جديد',
    Address: 'العنوان',
    'Address Line 1': 'عنوان السطر 1',
    'Address Line 2': 'عنوان السطر 2',
    City: 'المدينة',
    State: 'الولاية',
    Quantity: 'الكمية',
    'Item Group': 'مجموعة الصنف',
    Coupons: 'الكوبونات',
    'Shipping Cost': 'تكلفة النقل',
    'No shipping costs available': 'لا توجد تكاليف نقل متاحة',
    'Shipping Cost Price': 'سعر تكلفة النقل',
    'Document Date': 'تاريخ المستند',
    'Item Code': 'كود الصنف',
    UOM: 'الوحدة',
    Rate: 'السعر',
    'Discount Percentage': 'نسبة الخصم',
    'Discount Amount': 'قيمة الخصم',
    'Price List Rate': 'السعر الثابت',
    'Available Qty': 'الرصيد المتاح',
    'Stock Qty': 'رصيد المخزن',
    'Stock UOM': 'وحدة المخزن',
    'Promotional Scheme Applied': 'تم تطبيق عرض',
    'Serial No Qty': 'عدد السيريال',
    'Serial No': 'رقم السيريال',
    'Batch No.Available Qty': 'رقم الباتش.الكمية المتاحة',
    'Batch Expiry': 'إنتهاء صلاحية الباتش',
    'Batch No': 'رقم الباتش',
    'Additional Notes': 'ملاحظات إضافية',
    Total_Qty: 'إجمالي الكمية',
    'Apply Invoice_discount': 'خصم علي الفاتورة',
    'Items Discount': 'خصم الأصناف',
    'Please select customer': 'برجاء اختيار عميل',
    'Please make payment or select payments': 'برجاء إجراء دفعة أو اختيار دفعة',
    'Please select invoice': 'برجاء اختيار فاتورة',
    'Processing Payment': 'جاري معالجة الدفع',
    Name: 'اسم',
    'Apply On': 'تطبيق على',
    Offer: 'عرض',
    Add: 'إضافة',
    Coupon: 'كوبون',
    Type: 'النوع',
    'POS Offer': 'عرض نقاط البيع',
    'Update Customer': 'تحديث العميل',
    'New Customer': 'تسجيل عميل جديد',
    'Customer Name': 'إسم العميل',
    'Tax ID': 'رقم التعريف الضريبي',
    Email: 'البريد الإلكتروني',
    Gender: 'الجنس',
    'Referral Code': 'رمز الإحالة',
    'Date of Birth': 'تاريخ الميلاد',
    'Customer Group': 'مجموعة العميل',
    'Group not found': 'المجموعة غير موجودة',
    Territory: 'المنطقة',
    'Territory not found': 'المنطقة غير موجودة',
    'Loyalty Program': 'برنامج الولاء',
    'Loyalty Points': 'نقاط الولاء',
    'Register Customer': 'تسجيل العميل',
    'Customer name is required.': 'اسم العميل مطلوب.',
    'Customer group name is required.': 'اسم مجموعة العميل مطلوب.',
    'Customer territory name is required.': 'اسم منطقة العميل مطلوب.',
    'Customer created successfully.': 'تم إنشاء العميل بنجاح.',
    'Customer updated successfully.': 'تم تحديث العميل بنجاح.',
    'Failed to create customer.': 'فشل إنشاء العميل.',
    'Cancel current invoice?': 'إالغاء الفاتورة الحالية ?',
    'Cancel Invoice': 'إالغاء الفاتورة',
    Back: 'رجوع',
    Amount: 'القيمة',
    Return: 'مرتجع فاتورة',
    Drafts: 'الفواتير المحفوظه',
    Cancel: 'إلغاء',
    'Save as Draft': 'حفظ وانشاء جديد',
    Pay: 'دفع',
    'Print Draft': 'طباعة المسودة',
    Total: 'الإجمالي',
    'This serial number {0} is already added!': 'رقم السيريال هذا {0} قد تم إضافته بالفعل!',
    'No items found!': 'لا توجد عناصر!',
    "Discount percentage for item '{0}' cannot exceed {1}%":
      "نسبة الخصم للصنف '{0}' لايمكن ان تجاوز {1}%",
    "Available quantity '{0}' for item '{1}' is insufficient":
      "الكمية الموجوده هذه '{0}' للصنف '{1}' غير كافية",
    "Quantity for item '{0}' cannot be zero (0)": "الكمية للصنف '{0}' لا يمكن أن تكون صفر (0)",
    'Allowed discount for item {0} {1}': 'الخصم المسموح للصنف {0} {1}',
    'Serial numbers selected for item {0} are invalid':
      'الأرقام التسلسلية المحددة للصنف {0} غير صحيحة',
    'Discount percentage cannot be higher than {0}%': 'لا يمكن أن تكون نسبة الخصم أعلى من {0}%',
    'Return invoice total is invalid': 'مجموع فاتورة الإرجاع غير صحيح',
    'Return invoice total should not be higher than {0}':
      'مجموع فاتورة الإرجاع لا يجب أن يكون أعلى من {0}',
    'Quantity for item {0} cannot be greater than {1}':
      'الكمية للصنف {0} لا يمكن أن تكون أكبر من {1}',
    'You are not allowed to print pending invoices': 'لا يُسمح لك بطباعة الفواتير المعلقة',
    'Loyalty points offer applied': 'تم تطبيق عرض نقاط الولاء',
    items_discount: 'خصم الأصناف',
    list_price_amounts: 'السعر الأصلي',
    net_total: 'الصافي',
    grand_total: 'الإجمالي الكلي',
    Print: 'طباعة',
    'Quick Return': 'مرتجع سريع',
    'Scan Barcode': 'مسح الباركود',
    'Search Item': 'بحث عن الصنف',
    'Clear Cache': 'مسح الذاكرة المؤقتة',
    'About System': 'حول النظام',
    'Special Offers Total': 'إجمالي العروض الخاصة',
    'Special Offer': 'عرض خاص',
    Total: 'الإجمالي',
    Active: 'مفعل',
    'Offers Disabled': 'العروض معطلة',
    'Offers are disabled in POS Profile settings': 'العروض معطلة في إعدادات ملف نقاط البيع',
    'Back to Invoice': 'رجوع إلى الفاتورة',
    'Another offer active': 'عرض آخر نشط',
    Applied: 'مطبق',
    Apply: 'تطبيق',
    'Go to Desk': 'الذهاب إلى سطح المكتب',
    'Print Last Receipt': 'طباعة آخر إيصال',
    'No last receipt': 'لا يوجد اخر فاتورة',
    'Clear Cache': 'مسح الذاكرة المؤقتة',
    'List Price': 'السعر الأصلي',
    'Discount %': 'نسبة الخصم',
    'Discount Amount': 'قيمة الخصم',
    Delete: 'حذف',
  },
  en: {},
};

// =============================================================================
// LANGUAGE SELECTION - Change this value to switch languages
// =============================================================================
const posa_language = 'en'; // Options: 'ar' (Arabic) or 'en' (English)

// =============================================================================
// TRANSLATION FUNCTION
// =============================================================================
function posaTranslate(message, replace, context) {
  let translatedMessage = posaTranslations[posa_language][message] || message;

  // Handle placeholders like {0}, {1}, etc.
  if (replace && Array.isArray(replace)) {
    replace.forEach((val, i) => {
      translatedMessage = translatedMessage.replace(`{${i}}`, val);
    });
  }

  return translatedMessage;
}

// =============================================================================
// INITIALIZE TRANSLATION SYSTEM
// =============================================================================
window.__ = posaTranslate;
window.__messages = posaTranslations[posa_language] || {};

// =============================================================================
// PAGE SETUP
// =============================================================================

frappe.pages['posapp'].on_page_load = function (wrapper) {
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: 'Andalus Group',
    single_column: true,
  });

  this.page.$PosApp = new frappe.PosApp.posapp(this.page);

  $('div.navbar-fixed-top').find('.container').css('padding', '0');

  $('head').append(
    "<link rel='stylesheet' href='/assets/posawesome/css/materialdesignicons.css' class='posapp-mdi-css'>",
  );
  $('head').append('<style>.layout-main-section { display: none !important; }</style>');
};

frappe.pages['posapp'].on_page_leave = function () {
  $('head').find('link.posapp-mdi-css').remove();
};
