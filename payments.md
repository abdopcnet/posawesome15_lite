# payments.md

## Application structure

- `payments/` - Payments module
- `payment_gateways/` - Payment gateway integrations
- `utils/` - Utility functions
- `overrides/` - DocType overrides
- `templates/` - Checkout pages

## Supported payment gateways

- Razorpay, Stripe, PayPal, Paytm, Braintree, GoCardless

## Payment flow

1. Create Payment Gateway DocType
2. Configure gateway settings (Razorpay Settings, Stripe Settings, etc.)
3. Create Payment Request
4. Generate payment URL
5. Process payment callback
6. Update Integration Request status

## Key DocTypes

- Payment Gateway, Payment Request, Integration Request
- Razorpay Settings, Stripe Settings, PayPal Settings, etc.

## Integration patterns

- Check if payments app installed: `"payments" in frappe.get_installed_apps()`
- Create payment request: `from payments.utils import create_payment_request`
- Get payment URL: `gateway.get_payment_url(**kwargs)`
