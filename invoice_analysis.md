# إحصاء دقيق لملف Invoice.vue - تحليل السطور

## 📊 الإحصائيات العامة
- **إجمالي السطور**: 3197 سطر
- **السطور الفارغة**: ~200 سطر (تقديري)
- **السطور الفعلية**: ~2997 سطر

## 🗂️ تقسيم الملف الرئيسي

### 1. Template Section (السطور 1-397)
**عدد السطور: 397 سطر**

#### أ) Customer Section (السطور 8-14)
- **عدد السطور**: 7 سطور
- **المحتوى**: مكون العميل

#### ب) Posting Date Section (السطور 15-61)  
- **عدد السطور**: 47 سطر
- **المحتوى**: اختيار تاريخ النشر

#### ج) Items Table Section (السطور 63-232)
- **عدد السطور**: 170 سطر
- **المحتوى**: 
  - جدول المنتجات
  - أزرار الكمية (+/-)
  - حقول الأسعار
  - حقول الخصومات
  - أزرار الحذف

#### د) Summary Section (السطور 235-340)
- **عدد السطور**: 106 سطور
- **المحتوى**:
  - إجمالي الكمية
  - خصم الفاتورة
  - خصم المنتجات
  - المجموع قبل الخصم
  - المجموع الصافي
  - الضرائب
  - المجموع النهائي

#### هـ) Action Buttons Section (السطور 342-394)
- **عدد السطور**: 53 سطر
- **المحتوى**:
  - طباعة الفاتورة
  - الدفع
  - المرتجعات
  - المرتجعات السريعة
  - الإلغاء

### 2. Script Section (السطور 399-2531)
**عدد السطور: 2133 سطر**

#### أ) Imports & Setup (السطور 400-408)
- **عدد السطور**: 9 سطور
- **المحتوى**: استيراد المكتبات والمكونات

#### ب) Export Default (السطور 405-407)
- **عدد السطور**: 3 سطور
- **المحتوى**: تصدير المكون

#### ج) Data Properties (السطور 410-465)
- **عدد السطور**: 56 سطر
- **المحتوى**:
  - البيانات الأساسية (pos_profile, customer, etc.)
  - بيانات الفاتورة (items, discounts, etc.)
  - متغيرات التحسين (_autoSaveProcessing, etc.)
  - إعدادات الجدول (headers, precision, etc.)

#### د) Computed Properties (السطور 468-543)
- **عدد السطور**: 76 سطر
- **المحتوى**:
  - dynamicHeaders: رؤوس الجدول الديناميكية
  - readonly: حالة القراءة فقط
  - total_qty: إجمالي الكمية
  - Total, subtotal, TaxAmount: الحسابات المالية
  - defaultPaymentMode: طريقة الدفع الافتراضية
  - hasItems, hasChosenPayment: التحقق من الحالة

#### هـ) Methods Section (السطور 545-2310)
**عدد السطور: 1766 سطر**

##### المجموعات الوظيفية:

**1. إدارة الكميات (السطور 548-616)**
- **عدد السطور**: 69 سطر
- **الوظائف**:
  - onQtyChange() - 13 سطر
  - onQtyInput() - 4 سطر  
  - increaseQuantity() - 18 سطر
  - decreaseQuantity() - 23 سطر
  - refreshTotals() - 4 سطر
  - getDiscountAmount() - 27 سطر

**2. إدارة المنتجات (السطور 726-805)**
- **عدد السطور**: 80 سطر
- **الوظائف**:
  - add_item() - 79 سطر
  - generateRowId() - 3 سطر

**3. إدارة الفواتير (السطور 810-1280)**
- **عدد السطور**: 471 سطر
- **الوظائف**:
  - create_draft_invoice() - 24 سطر
  - auto_update_invoice() - 137 سطر
  - queue_auto_save() - 17 سطر
  - _run_auto_save_worker() - 35 سطر
  - reload_invoice() - 20 سطر
  - debounced_auto_update() - 9 سطر
  - get_new_item() - 105 سطر
  - cancel_invoice() - 36 سطر
  - delete_draft_invoice() - 16 سطر
  - reset_invoice_session() - 16 سطر
  - new_invoice() - 63 سطر
  - get_invoice_doc() - 38 سطر
  - get_invoice_items_minimal() - 14 سطر
  - get_payments() - 35 سطر
  - update_invoice() - 50 سطر
  - process_invoice() - 25 سطر

**4. إدارة المدفوعات (السطور 1409-1456)**
- **عدد السطور**: 48 سطر
- **الوظائف**:
  - show_payment() - 48 سطر

**5. إدارة الخصومات (السطور 1590-1651)**
- **عدد السطور**: 62 سطر
- **الوظائف**:
  - setDiscountPercentage() - 35 سطر
  - update_price_list() - 6 سطر
  - update_discount_umount() - 17 سطر
  - logPriceDisplay() - 8 سطر

**6. إدارة الباتشات والسلاسل (السطور 1655-1729)**
- **عدد السطور**: 75 سطر
- **الوظائف**:
  - set_serial_no() - 8 سطر
  - set_batch_qty() - 67 سطر

**7. إدارة العروض (السطور 1901-2106)**
- **عدد السطور**: 206 سطر
- **الوظائف**:
  - handelOffers() - 12 سطر
  - _processOffers() - 92 سطر
  - getItemFromRowID() - 3 سطر
  - checkOfferCoupon() - 20 سطر
  - getItemOffer() - 15 سطر
  - updatePosOffers() - 3 سطر
  - updateInvoiceOffers() - 7 سطر
  - removeApplyOffer() - 9 سطر
  - applyNewOffer() - 20 سطر
  - applyOffersToInvoice() - 20 سطر
  - removeOffersFromInvoice() - 20 سطر

**8. إدارة العمليات (السطور 1880-1899)**
- **عدد السطور**: 20 سطر
- **الوظائف**:
  - debouncedItemOperation() - 15 سطر
  - processItemOperations() - 20 سطر

**9. التحقق والتحقق (السطور 1458-1528)**
- **عدد السطور**: 71 سطر
- **الوظائف**:
  - validate() - 25 سطر
  - get_draft_invoices() - 20 سطر
  - open_returns() - 14 سطر
  - close_payments() - 3 سطر
  - update_items_details() - 5 سطر
  - update_item_detail() - 4 سطر

**10. إدارة العملاء (السطور 1550-1633)**
- **عدد السطور**: 84 سطر
- **الوظائف**:
  - fetch_customer_details() - 20 سطر
  - get_price_list() - 16 سطر
  - update_price_list() - 6 سطر

**11. اختصارات لوحة المفاتيح (السطور 1731-1758)**
- **عدد السطور**: 28 سطر
- **الوظائف**:
  - shortOpenPayment() - 6 سطر
  - shortDeleteFirstItem() - 6 سطر
  - shortOpenFirstItem() - 6 سطر
  - shortSelectDiscount() - 6 سطر
  - makeid() - 10 سطر

**12. وظائف مساعدة (السطور 1772-1879)**
- **عدد السطور**: 108 سطر
- **الوظائف**:
  - checkOfferIsAppley() - 28 سطر
  - mergeItemsFromAPI() - 78 سطر

**13. طباعة الفاتورة (السطور 2148-2292)**
- **عدد السطور**: 145 سطر
- **الوظائف**:
  - debugTableDimensions() - 15 سطر
  - printInvoice() - 130 سطر

**14. وظائف إضافية (السطور 2293-2310)**
- **عدد السطور**: 18 سطر
- **الوظائف**:
  - getPaymentsComponent() - 9 سطر
  - hasManualPayments() - 9 سطر

#### و) Lifecycle Hooks (السطور 2312-2450)
**عدد السطور: 139 سطر**

- **mounted()** (السطور 2312-2413): 102 سطر
- **beforeDestroy()** (السطور 2414-2450): 37 سطر
- **created()** (السطور 2451-2456): 6 سطر
- **destroyed()** (السطور 2457-2462): 6 سطر

#### ز) Watchers (السطور 2464-2524)
**عدد السطور: 61 سطر**

- **customer()** (السطور 2465-2475): 11 سطر
- **customer_info()** (السطور 2476-2478): 3 سطر
- **discount_percentage_offer_name()** (السطور 2479-2483): 5 سطر
- **items** (السطور 2484-2506): 23 سطر
- **invoiceType()** (السطور 2507-2509): 3 سطر
- **invoice_doc** (السطور 2510-2518): 9 سطر
- **discount_amount()** (السطور 2519-2523): 5 سطر
- **updated()** (السطور 2525-2529): 5 سطر

### 3. Style Section (السطور 2533-3197)
**عدد السطور: 665 سطر**

#### أ) التصميمات الأساسية (السطور 2534-2603)
- **عدد السطور**: 70 سطر
- **المحتوى**: تصميمات الحاويات والعناصر الأساسية

#### ب) تصميم الجدول (السطور 2604-3051)
- **عدد السطور**: 448 سطر
- **المحتوى**: تصميمات الجدول والحقول والأزرار

#### ج) التصميم المتجاوب (السطور 3052-3197)
- **عدد السطور**: 146 سطر
- **المحتوى**: تصميمات للشاشات المختلفة

## 📈 تحليل التعقيد

### أكثر الأجزاء تعقيداً:
1. **Methods Section**: 1766 سطر (55% من الملف)
2. **Style Section**: 665 سطر (21% من الملف)
3. **Template Section**: 397 سطر (12% من الملف)
4. **Data & Computed**: 132 سطر (4% من الملف)
5. **Lifecycle & Watchers**: 200 سطر (6% من الملف)

### أكثر الوظائف تعقيداً:
1. **auto_update_invoice()**: 137 سطر
2. **add_item()**: 79 سطر
3. **mergeItemsFromAPI()**: 78 سطر
4. **printInvoice()**: 130 سطر
5. **_processOffers()**: 92 سطر

## 🎯 توصيات التقسيم

بناءً على هذا التحليل، يمكن تقسيم الملف إلى:

1. **InvoiceMain.vue** (~400 سطر)
2. **InvoiceItemsTable.vue** (~600 سطر)
3. **InvoiceSummary.vue** (~300 سطر)
4. **InvoiceActions.vue** (~400 سطر)
5. **InvoiceOffers.vue** (~500 سطر)
6. **InvoiceBatchManager.vue** (~400 سطر)
7. **InvoiceAPI.js** (~300 سطر)
8. **InvoiceUtils.js** (~200 سطر)
9. **InvoiceComposables.js** (~300 سطر)

هذا التقسيم سيجعل كل ملف أكثر تركيزاً وقابلية للصيانة.
