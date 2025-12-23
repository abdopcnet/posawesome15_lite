# POS Awesome - Workflow

## Main POS Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    POS Application Start                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   Check Existing Open Shift   │
        └───────────────┬───────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
    ┌───────────────┐      ┌───────────────┐
    │  Shift Open   │      │  No Shift     │
    └───────┬───────┘      └───────┬───────┘
            │                      │
            │                      ▼
            │          ┌───────────────────────┐
            │          │  Opening Dialog       │
            │          │  - Select POS Profile │
            │          │  - Enter Balances     │
            │          └───────────┬───────────┘
            │                      │
            │                      ▼
            │          ┌───────────────────────┐
            │          │  Create Opening      │
            │          │  Shift (Submit)      │
            │          └───────────┬───────────┘
            │                      │
            └──────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │      POS Main Interface        │
        │  - Item Selection              │
        │  - Customer Selection          │
        │  - Payment Processing          │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │    Create Sales Invoice       │
        │  - Add Items                  │
        │  - Apply Discounts/Offers      │
        │  - Process Payments           │
        └───────────────┬───────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
    ┌───────────────┐      ┌───────────────┐
    │  Save Draft   │      │  Submit &     │
    │               │      │  Print        │
    └───────────────┘      └───────┬───────┘
                                   │
                                   ▼
                    ┌───────────────────────────┐
                    │  Continue Processing      │
                    │  or Close Shift           │
                    └───────────┬───────────────┘
                                │
                                ▼
                    ┌───────────────────────────┐
                    │    Closing Dialog         │
                    │  - Review Totals          │
                    │  - Enter Closing Balances │
                    └───────────┬───────────────┘
                                │
                                ▼
                    ┌───────────────────────────┐
                    │  Create Closing Shift    │
                    │  (Submit)                │
                    └───────────┬───────────────┘
                                │
                                ▼
                    ┌───────────────────────────┐
                    │  Auto-Print (if enabled) │
                    │  or Manual Print          │
                    └───────────┬───────────────┘
                                │
                                ▼
                    ┌───────────────────────────┐
                    │  Page Reload              │
                    │  (Back to Opening)        │
                    └───────────────────────────┘
```

## Shift Status Workflow

```
POS Opening Shift Status:
┌─────────┐
│ Draft   │ ──Submit──> ┌─────────┐
└─────────┘             │  Open   │ ──Close──> ┌─────────┐
                        └─────────┘             │ Closed  │
                                                └─────────┘
```

## Invoice Workflow

```
Sales Invoice:
┌─────────┐
│ Draft   │ ──Submit──> ┌─────────┐
└─────────┘             │Submitted│
                        └─────────┘
```

## Key Workflow Components

1. **Opening Shift**

    - User selects POS Profile
    - Enters opening balances
    - System validates time window (if enabled)
    - Creates and submits POS Opening Shift

2. **POS Operations**

    - Item selection and barcode scanning
    - Customer selection
    - Payment processing
    - Invoice creation (draft or submit)

3. **Closing Shift**
    - System calculates totals
    - User enters closing balances
    - System validates time window (if enabled)
    - Creates and submits POS Closing Shift
    - Auto-print (if enabled)
    - Page reloads to opening screen

## Event Flow

-   `register_pos_profile` - POS Profile registered
-   `set_pos_opening_shift` - Opening shift set
-   `register_pos_data` - POS data registered
-   `stop_shift_monitoring` - Stop shift monitoring
-   `submit_closing_pos` - Closing shift submitted
