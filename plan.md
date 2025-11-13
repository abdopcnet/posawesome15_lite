## Default Customer Lookup Issue

1. Inspect frontend logic that loads default customer data to see how the list of customers is cached and validated.
2. Review backend methods such as `posawesome.posawesome.api.customer.get_customer` and related helpers to confirm expected payload structure.
3. Determine why the configured default customer (`عميل نقدي الجموم`) is missing from the loaded customer set during POS initialization.
4. Implement a fix to ensure the default customer is available (or gracefully fetched) before the POS proceeds.
5. Test the POS boot flow to verify the default customer loads without console errors and document any remaining concerns.
