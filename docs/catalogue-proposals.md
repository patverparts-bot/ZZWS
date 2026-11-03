# Catalogue proposals

`Առաջարկ` is next to the existing list picker in the authenticated catalogue. It accepts pasted rows or a single-sheet XLSX/CSV/TSV/TXT file, up to 2,000 rows / 5 MB. Columns are model or article, quantity, optional price. Recognized headers are Armenian, Russian and English. Ambiguous/unmatched rows must be corrected before preview or sharing; they are never silently omitted. Article leading zeroes are preserved.

An administrator chooses `Հիմնական գործընկեր` (KP) or `Մշտական գործընկեր` (Dealers). Defaults come from the current server category pricing rules, including promotion selection. Clients use their own authorized projected catalogue and price; they cannot switch to another category's prices. A nonempty input price overrides the category price. `Հատուկ առաջարկ` appears only when the input price differs numerically from that category price. Equal prices have no special label. Missing category prices remain blank.

Preview is a standalone clean view with the project logo and product photo/name/article/price/quantity cards. Catalogue navigation, working tools, AI, cart and personal account are hidden. Only the author sees share and return controls; recipients do not. Both preview and public page show the sum of price × quantity. If any line has no price, the amount is explicitly labelled as a subtotal of known prices and the unpriced quantity is shown. The normal catalogue returns on exit. Existing stock selection, reservations, cart and order data are unchanged. Starting the stock picker's visual view exits offer display, and vice versa.

Sharing saves an immutable projection of just those article/name/category/brand/quantity/price/special fields. The opaque 256-bit random capability is stored as a SHA-256 hash; the public response never includes other catalogue rows, stock, other category prices or owner identity. Unaddressed recipients open `offer.html#TOKEN` without signing in; addressed offers require the chosen customer account. No credentials are attached to the public request. Both server reads and the public page enforce the creator-selected validity, defaulting to 7 days from creation. Reusing the share button reuses the same link; it does not extend expiry. Server revalidation rejects changed regular prices and products no longer in the creator's authorized catalogue. Proposals are temporary views, not orders or reservations.

Database installation: `supabase/proposals.sql` (also in the clean installer). Existing installations must apply this SQL once before deploying `zzws-api` with `proposals.mjs`, then deploy the frontend assets. The table has RLS and no `anon`/`authenticated` grants. Only the existing server service role can insert/read/delete. Expired rows are inaccessible through the endpoint; no background cleanup is required for expiry enforcement. These ephemeral links are not part of the existing application snapshot.

Checks:

- `node tests/proposals.integration.mjs`: input, category prices, authorized projection, anonymous capability access, 7-day expiration and direct table access rejection.
- `node tests/ui/proposals.cjs`: paste/file, equal/different prices, card preview, repeat sharing, public mobile page.
- `node tests/ui/stock-picker-catalog.cjs`: existing admin/client stock selection and cart regression.

This change does not update the native Android application or publish a new APK.

## Addressed offers and checkout

Administrators with the existing order-write permission can search/select a customer in the offer dialog. Without a selected customer, the link remains a standalone read-only page without login or workspace controls. With a selected customer, the public endpoint returns only a login redirect indicator, never product data. The recipient must sign in as that customer's primary account or employee. A different company and an administrator cannot open the addressed catalogue view.

An authenticated inbox polls every 30 seconds and on returning to the tab. Unread offers appear as direct “open offer” notifications. Opening marks the offer as read, displays all its products/prices/initial quantities in a dedicated filtered view of the recipient's working catalogue, and leaves the ordinary catalogue permissions unchanged. Leaving this view restores the usual product list. Viewing does not change basket contents or prices.

Adding products requires a separate authenticated acceptance. Basket lines carry `proposalHash`; this provenance survives local/server basket restoration. Only those lines use the stored offer price. Quantity can be changed within the existing order limits. Other lines use the customer's currently authorized catalogue prices. Server quote and submit handlers validate the account, active offer and accepted source; no client-supplied unit price can authorize a discount or inaccessible product. The immutable order calculation evidence records the offer source/hash. A database trigger rechecks offer ownership, expiry and price in the order transaction. Normal delivery/receipt gates, order statuses and retry identities are unchanged.

The creator can select validity from 1 to 365 days; the default is 7 days in both modes. The server sets creation/expiry times. Expiry blocks new acceptance and new order submission using the offer. An already accepted order and its idempotent retry remain intact. Deleting the recipient deletes their addressed offers, preventing private links from becoming public.

All catalogue workflows are grouped in `Կատալոգի գործիքներ`: lists/import, offers, and view/export. Existing controls are moved with their original handlers; duplicate navigation entries are removed.

Additional installation for existing sites: `supabase/proposal-validity.sql`, then `supabase/proposal-recipients.sql`; the clean installer includes both. These add server-only tables for read receipts and accepted basket permissions.

Additional checks: `tests/proposal-orders.integration.mjs` and `tests/ui/proposal-customer.cjs` cover recipient isolation, explicit visibility, notifications, login redirect, mixed basket/order prices, quantity changes, reload, expiry and idempotency. Existing standard checkout, stock-picker, employee contract, approval and history checks are also run.
