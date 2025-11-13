## POS Boot & Return Fixes

1. Reproduce the POS boot flow to inspect duplicated requests and confirm the default customer fix holds.
2. Re-run the return invoice path to verify `sales_invoice_item`/`si_detail` linkage and collect any remaining warnings.
3. Patch `get_invoice_items_minimal` and `createReturnInvoiceDoc` so return metadata (warehouse, stock_qty, link fields) is always present.
4. Update the frontend API mapper to point item calls at `posawesome.posawesome.api.item` (singular) and remove references to the non-existent `items` module.
5. Validate the POS launch and return submission again, ensuring both the missing-module error and previous warnings are resolved.
6. Document open edge cases (negative stock scenario, quick returns) and any follow-up actions.
