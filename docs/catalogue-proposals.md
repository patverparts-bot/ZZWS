# Catalogue proposals

`Առաջարկ` is next to the existing list picker in the authenticated catalogue. It accepts pasted rows or a single-sheet XLSX/CSV/TSV/TXT file, up to 2,000 rows / 5 MB. Columns are model or article, quantity, optional price. Recognized headers are Armenian, Russian and English. Ambiguous/unmatched rows must be corrected before preview or sharing; they are never silently omitted. Article leading zeroes are preserved.

An administrator chooses `Հիմնական գործընկեր` (KP) or `Մշտական գործընկեր` (Dealers). Defaults come from the current server category pricing rules, including promotion selection. Clients use their own authorized projected catalogue and price; they cannot switch to another category's prices. A nonempty input price overrides the category price. `Հատուկ առաջարկ` appears only when the input price differs numerically from that category price. Equal prices have no special label. Missing category prices remain blank.

Preview is a standalone clean view with the project logo and product photo/name/article/price/quantity cards. Catalogue navigation, working tools, AI, cart and personal account are hidden. Only the author sees share and return controls; recipients do not. Both preview and public page show the sum of price × quantity. If any line has no price, the amount is explicitly labelled as a subtotal of known prices and the unpriced quantity is shown. The normal catalogue returns on exit. Existing stock selection, reservations, cart and order data are unchanged. Starting the stock picker's visual view exits offer display, and vice versa.

Sharing saves an immutable projection of just those article/name/category/brand/quantity/price/special fields. The opaque 256-bit random capability is stored as a SHA-256 hash; the public response never includes other catalogue rows, stock, other category prices or owner identity. Recipients open `offer.html#TOKEN` without signing in. No credentials are attached to the public request. Both server reads and the public page enforce exactly 168 hours from creation. Reusing the share button reuses the same link; it does not extend expiry. Server revalidation rejects changed regular prices and products no longer in the creator's authorized catalogue. Proposals are temporary views, not orders or reservations.

Database installation: `supabase/proposals.sql` (also in the clean installer). Existing installations must apply this SQL once before deploying `zzws-api` with `proposals.mjs`, then deploy the frontend assets. The table has RLS and no `anon`/`authenticated` grants. Only the existing server service role can insert/read/delete. Expired rows are inaccessible through the endpoint; no background cleanup is required for expiry enforcement. These ephemeral links are not part of the existing application snapshot.

Checks:

- `node tests/proposals.integration.mjs`: input, category prices, authorized projection, anonymous capability access, 7-day expiration and direct table access rejection.
- `node tests/ui/proposals.cjs`: paste/file, equal/different prices, card preview, repeat sharing, public mobile page.
- `node tests/ui/stock-picker-catalog.cjs`: existing admin/client stock selection and cart regression.

This change does not update the native Android application or publish a new APK.
