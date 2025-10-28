# 🎁 POS Offers System - Complete Implementation Guide

**💰 Budget**: $30 ~ 40$

**👨‍💻 Developer**: Merdan Charyyarov

**💳 Payment**: $40

**🎯 Priority**: 🔥 Normal

**📊 Status**: 🔄 In Progress

---

## 📖 Overview

This document provides a comprehensive explanation of the POS Awesome offers system for developers. The system implements various discount strategies using percentage-based calculations.

**Key Principle**: All offers are essentially discount percentages applied to items or the entire transaction.

---

## 🏗️ System Architecture

### Frontend Components

- `Invoice.js` - Main invoice handling, applies offers to items
- `Invoice.vue` - UI for invoice display with discount columns
- `PosOffers.js` - Offers management component
- `PosOffers.vue` - UI for displaying and toggling offers

### Backend Components

- `pos_offer` - ERPNext DocType for offer definitions
- `pos_offer_detail` - Child table(into sales invoice) for offer rules appears here what type applied
  and what is the amout of discount

---

## 🎯 All 6 Offer Types - Validation & Execution Logic

### 1. **item_code** Offer

**validate_logic**:

```
IF:
  offer_type = 'item_code'
  AND disable = 0
  AND auto = 1
  AND POS Profile.posa_auto_fetch_offers = 1
THEN:
  offer card will show
  offer will apply automatically
```

**execute_logic**:

```
IF tabPOS Offer.item_code = tabSales Invoice Item.item_code
THEN:
  SET tabSales Invoice Item.discount_percentage = tabPOS Offer.discount_percentage
  SET tabSales Invoice Item.rate = calculateDiscountedPrice(item, discount_percentage)
  SET tabSales Invoice Item.amount = rate × qty
```

---

### 2. **item_group** Offer

**validate_logic**:

```
IF:
  offer_type = 'item_group'
  AND disable = 0
  AND auto = 1
  AND POS Profile.posa_auto_fetch_offers = 1
THEN:
  offer card will show
  offer will apply automatically
```

**execute_logic**:

```
IF tabPOS Offer.item_group = tabSales Invoice Item.item_group
THEN:
  SET tabSales Invoice Item.discount_percentage = tabPOS Offer.discount_percentage
  SET tabSales Invoice Item.rate = calculateDiscountedPrice(item, discount_percentage)
  SET tabSales Invoice Item.amount = rate × qty
```

---

### 3. **brand** Offer

**validate_logic**:

```
IF:
  offer_type = 'brand'
  AND disable = 0
  AND auto = 1
  AND POS Profile.posa_auto_fetch_offers = 1
THEN:
  offer card will show
  offer will apply automatically
```

**execute_logic**:

```
IF tabPOS Offer.brand = tabSales Invoice Item.brand
THEN:
  SET tabSales Invoice Item.discount_percentage = tabPOS Offer.discount_percentage
  SET tabSales Invoice Item.rate = calculateDiscountedPrice(item, discount_percentage)
  SET tabSales Invoice Item.amount = rate × qty
```

---

### 4. **customer** Offer

**validate_logic**:

```
IF:
  offer_type = 'customer'
  AND disable = 0
  AND auto = 1
  AND POS Profile.posa_auto_fetch_offers = 1
  AND tabSales Invoice.customer = tabPOS Offer.customer
THEN:
  offer card will show
  offer will apply automatically
```

**execute_logic**:

```
IF tabPOS Offer.customer = tabSales Invoice.customer
THEN:
  SET tabSales Invoice.additional_discount_percentage = tabPOS Offer.discount_percentage
  SET tabSales Invoice.offer_discount_percentage = tabPOS Offer.discount_percentage
  RECALCULATE all invoice amounts with discount applied
```

---

### 5. **customer_group** Offer

**validate_logic**:

```
IF:
  offer_type = 'customer_group'
  AND disable = 0
  AND auto = 1
  AND POS Profile.posa_auto_fetch_offers = 1
  AND tabCustomer.customer_group = tabPOS Offer.customer_group
THEN:
  offer card will show
  offer will apply automatically
```

**execute_logic**:

```
IF tabPOS Offer.customer_group = tabCustomer.customer_group
THEN:
  SET tabSales Invoice.additional_discount_percentage = tabPOS Offer.discount_percentage
  SET tabSales Invoice.offer_discount_percentage = tabPOS Offer.discount_percentage
  RECALCULATE all invoice amounts with discount applied
```

---

### 6. **grand_total** Offer

**validate_logic**:

```
IF:
  offer_type = 'grand_total'
  AND disable = 0
  AND auto = 1
  AND POS Profile.posa_auto_fetch_offers = 1
  AND tabSales Invoice.total_qty >= tabPOS Offer.min_qty (if set)
  AND tabSales Invoice.total >= tabPOS Offer.min_amt (if set)
THEN:
  offer card will show
  offer will apply automatically
```

**execute_logic**:

```
IF invoice conditions meet min_qty/min_amt
THEN:
  SET tabSales Invoice.additional_discount_percentage = tabPOS Offer.discount_percentage
  SET tabSales Invoice.offer_discount_percentage = tabPOS Offer.discount_percentage
  SET tabSales Invoice.discount_amount = (grand_total × discount_percentage) / 100
  SET tabSales Invoice.grand_total = grand_total - discount_amount
```

---

## 🔄 Complete Data Flow

### Step 1: Offer Loading (Pos.js → PosOffers.js)

```javascript
// When POS opens, load offers for current POS Profile
frappe.call({
  method: 'posawesome.posawesome.doctype.pos_offer.pos_offer.get_offers_for_profile',
  args: { pos_profile: this.pos_profile.name },
  callback: (r) => {
    // Send offers to PosOffers component
    evntBus.emit('set_offers', r.message);
  },
});
```

### Step 2: Offer Display (PosOffers.vue)

```vue
<template>
  <div v-for="offer in pos_offers" @click="toggleOffer(offer)">
    {{ offer.name }} - {{ offer.discount_percentage }}% off
  </div>
</template>
```

### Step 3: User Activates Offer (PosOffers.js)

```javascript
toggleOffer(offer) {
  offer.offer_applied = !offer.offer_applied;

  if (offer.offer_applied) {
    this.$emit('offerApplied', offer);
  } else {
    this.$emit('offerRemoved', offer);
  }
}
```

### Step 4: Offer Applied to Invoice (Invoice.js)

```javascript
watch: {
  offerApplied: {
    handler(offer) {
      if (offer.offer_type === 'item_code' || offer.offer_type === 'item_group') {
        this.applyItemOffer(offer);
      } else if (offer.offer_type === 'grand_total') {
        this.additional_discount_percentage = offer.discount_percentage;
        this.offer_discount_percentage = offer.discount_percentage;
      }
    }
  }
}

applyItemOffer(offer) {
  this.items.forEach(item => {
    if (item.item_code === offer.item_code) {
      item.discount_percentage = offer.discount_percentage;
      item.rate = this.calculateDiscountedPrice(item, offer.discount_percentage);
      item.amount = this.calculateItemAmount(item);
    }
  });
  this.updateInvoiceDocLocally();
}
```

### Step 5: Price Calculation (Invoice.js)

```javascript
calculateDiscountedPrice(item, discountPercent) {
  const originalPrice = item.price_list_rate || item.rate;
  const discountAmount = (originalPrice * discountPercent) / 100;
  return flt(originalPrice - discountAmount, this.currency_precision);
}

calculateItemAmount(item) {
  return flt(
    flt(item.rate || 0, this.float_precision) *
    flt(Math.abs(item.qty || 0), this.float_precision),
    this.currency_precision
  );
}
```

---

## 💾 Database Structure

### `POS Offer` DocType

```python
Fields:
- name: str              # Offer identifier
- offer_name: str        # Display name
- offer_type: str        # 'item_code', 'item_group', 'brand', 'grand_total', 'customer', 'customer_group'
- discount_percentage: float  # Discount percentage (e.g., 20 for 20%)
- item_code: str         # For item_code offers
- item_group: str        # For item_group offers
- brand: str             # For brand offers
- customer: str          # For customer offers
- customer_group: str    # For customer_group offers
- min_qty: int           # Minimum quantity required
- min_amount: float      # Minimum purchase amount
- valid_from: date       # Offer start date
- valid_upto: date       # Offer end date
- pos_profile: str       # Which POS profiles can use this offer
- auto: int              # Auto-apply when conditions are met (1 = yes, 0 = no)
```

### `POS Offer Detail` (Child Table)

```python
Fields:
- apply_item_code: str   # Specific item for item_code offers
- apply_item_group: str  # Item group for item_group offers
- less_then: float       # Maximum price for "cheapest item" logic
```

---

## 🎨 UI Components

### Invoice Table Columns

```javascript
// In Invoice.vue
items_headers: [
  { title: 'Item Name', key: 'item_name' },
  { title: 'Qty', key: 'qty' },
  { title: 'Price', key: 'rate' },
  { title: 'Discount %', key: 'discount_percentage' }, // 👈 Shows offer discount
  { title: 'Discount Amount', key: 'discount_amount' },
  { title: 'Total', key: 'amount' },
  { title: 'Delete', key: 'actions' },
];
```

**Why These Columns**:

- Shows customer what discount they're getting
- Transparent pricing
- Real-time updates when offers are applied

---

## 🔧 Key Implementation Details

### 1. Offer State Management

```javascript
// In Invoice.js data()
offerApplied: null,      // Currently applied offer object
offerRemoved: false,     // Boolean or object when offer removed
_sessionOffers: [],      // All available offers
_lastCustomer: null,     // Track customer changes to reload offers
```

### 2. Discount Application Logic

```javascript
// Auto-applied offers (auto = 1)
if (offer.auto && offer.discount_percentage) {
  // Apply to matching items
  this.items.forEach(item => {
    if (matchesOffer(item, offer)) {
      item.discount_percentage = offer.discount_percentage;
      updateItemPrice(item);
    }
  });
}

// Manual offers (user toggles on/off)
toggleOffer(offer) {
  if (offer.offer_applied) {
    this.applyOffer(offer);
  } else {
    this.removeOffer(offer);
  }
}
```

### 3. Restoring Original Prices

```javascript
// When offer is removed, restore original discount
clearItemOfferDiscounts() {
  this.items.forEach(item => {
    if (item._offer_discount_applied) {
      item.discount_percentage = item._original_discount_percentage || 0;
      item.rate = this.calculateDiscountedPrice(item, item.discount_percentage);
      item.amount = this.calculateItemAmount(item);
      delete item._offer_discount_applied;
      delete item._offer_name;
    }
  });
  this.updateInvoiceDocLocally();
}
```

---

## 📊 Integration Points

### 1. Barcode Scanning

When items are scanned, offers auto-apply if conditions are met:

```javascript
// In ItemsSelector.js
process_barcode(barcode) {
  // Add item to cart
  evntBus.emit('add_item', response.message);

  // Invoice.js automatically checks and applies offers
}
```

### 2. Payment Processing

Offers affect the final amount:

```javascript
// In Invoice.js - show_payment()
const invoice_doc = this.process_invoice();
// invoice_doc.grand_total already includes offer discounts
```

### 3. Customer Changes

When customer changes, reload offers:

```javascript
watch: {
  customer(newCustomer) {
    if (newCustomer !== this._lastCustomer) {
      this.loadOffersForCustomer(newCustomer);
    }
  }
}
```

---

## 🧪 Testing Scenarios

### Scenario 1: Item Group Offer

1. Add 3 items from "Electronics" group
2. Activate "20% off Electronics" offer
3. **Expected**: All Electronics items show 20% discount
4. **Verify**: Invoice total reduced by 20%

### Scenario 2: Grand Total Offer

1. Add items totaling $1000
2. Activate "10% off orders over $500"
3. **Expected**: Entire cart gets 10% off
4. **Verify**: Grand total is $900

### Scenario 3: Multiple Offers

1. Add Samsung phone ($1000)
2. Activate "20% off Samsung" (item-level)
3. Activate "10% off orders over $500" (transaction-level)
4. **Expected**: Phone gets 20% off first ($800), then 10% off total
5. **Verify**: Final price = $720

---

## 📋 Current System Features

✅ **Implemented**:

- Item-level percentage discounts
- Transaction-level percentage discounts
- Customer-specific discounts
- Auto-apply offers
- Manual toggle offers
- Real-time price updates
- Invoice UI integration

❌ **Not Yet Implemented**:

- Bundle offers (Buy X, Get Y)
- Give Product offers
- Minimum quantity restrictions
- Time-based offers

---

## 🎯 Implementation Requirements

### Backend API Endpoints Needed

```python
# posawesome/posawesome/api/offers.py

@frappe.whitelist()
def get_offers_for_profile(pos_profile_name):
    """
    Get all active offers for a POS Profile.
    Returns: List of offer objects
    """
    pass

@frappe.whitelist()
def get_applicable_offers(invoice_items, customer, pos_profile):
    """
    Determine which offers can apply to current invoice.
    Returns: List of applicable offers
    """
    pass

@frappe.whitelist()
def apply_offers_to_invoice(invoice_doc, offer_names):
    """
    Apply selected offers and calculate final prices.
    Returns: Updated invoice document
    """
    pass
```

### Frontend Updates Needed

1. **Enhance PosOffers.vue**:
   - Show offer conditions (min amount, etc.)
   - Display savings amount
   - Better visual feedback

2. **Enhance Invoice.vue**:
   - Highlight items with active offers
   - Show offer name in item row
   - Display total savings from offers

3. **Add Offer Analytics**:
   - Track which offers are most used
   - Show offer performance metrics

---

## 🔍 Key Code Files

| File                   | Purpose                               | Lines     |
| ---------------------- | ------------------------------------- | --------- |
| `Invoice.js`           | Apply offers, calculate discounts     | ~2200     |
| `Invoice.vue`          | Display invoice with discount columns | ~900      |
| `PosOffers.js`         | Manage offer state, toggle offers     | ~340      |
| `PosOffers.vue`        | Display available offers              | ?         |
| `api/offers.py`        | Backend offer logic                   | TO CREATE |
| `doctype/pos_offer.py` | Offer DocType definition              | ?         |

---

## 💡 Important Notes for Developers

### 1. **All Offers = Discount Percentage**

Every offer in the system is fundamentally a percentage discount. The complexity comes from:

- **When** to apply (conditions)
- **To What** to apply (items vs transaction)
- **How Much** to apply (percentage value)

### 2. **Price Calculation Flow**

```
Original Price → Apply Item Discount → Apply Transaction Discount → Add Tax → Final Price
      $1000     →      $800 (-20%)     →       $720 (-10%)        →   $720  →    $756
```

### 3. **State Management**

- Offers can be **auto-applied** (auto = 1) or **manual** (auto = 0)
- Auto-applied offers reapply when items change
- Manual offers require user toggling
- Only one grand-total offer can be active at a time

### 4. **Customer Changes**

When customer changes:

1. Clear all current offer discounts
2. Reload offers for new customer
3. Auto-apply offers (if auto = 1)

---

## 🚀 Next Steps

1. **Analyze** current `PosOffers.vue` implementation
2. **Create** `api/offers.py` with three main functions
3. **Test** offer application with various scenarios
4. **Implement** UI enhancements in PosOffers.vue
5. **Add** offer analytics tracking

---

## 📞 Contact

For questions about this system, contact the POS Awesome development team.

**Remember**: Simplicity is key. Every offer is just a percentage discount with conditions!
