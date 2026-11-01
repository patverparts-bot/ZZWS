# ZZWS file layout

## Customer archive and access closure

The owner can choose Close access and move to archive from a main customer card.
An explicit reason (3–1000 characters) and the current administrator password are
required. The archive records the reason, Yerevan date/time and administrator name;
search matches customer, code, reason or administrator, with 50 entries per page.
Only owners can view it or restore a customer. Deleted customers remain separate.

The SQL transaction saves each team member's prior access state, disables the whole
team, revokes sessions/invitations and retains all existing prices, carts, delivery
variants, orders and report author snapshots. Working client lists and assisted-order
selection exclude archived accounts. A database guard prevents stale cards/imports
from editing or enabling archived accounts. Password reset/invitation endpoints also
reject them before changing Auth credentials. Customer codes remain reserved.

Restore requires the current administrator password and a matching card revision.
It returns the customer to working lists and restores only the access settings from
before archiving. Already disabled managers/employees stay disabled. Old sessions
and invitations never revive; unused invitations must be issued again. Audit records
retain the original reason and administrator after restoration/repeated archiving.
All archive metadata is part of existing encrypted application snapshots; it is never
exposed in a client's personal profile.

Migration: `supabase/migrations/20261101061259_client_archive.sql`.
UI: `admin/client-archive.js`, with the existing critical confirmation dialog.
API: GET/POST `admin/users/archive`, POST `admin/users/restore`.
Validation covers permissions, reason/password validation, whole-team closure,
preserved history/delivery, prior-disabled access restoration, stale requests,
revoked invitations, search escaping and pagination. Browser coverage includes both
languages/guides, cancellation, password errors, search, persistence, restoration
and mobile layout. Real Auth is exercised only on temporary staging accounts.

## Customer deletion with password confirmation

The owner opens the main customer card and chooses Delete customer. A red critical
warning names the customer and explains that access for the entire team and unused
invitations will end while order, delivery and report history stays available.
Every attempt requires the acting administrator's current password, checked against
Auth on the server with rate limiting and the existing MFA session requirement.
A recent general reauthentication cannot bypass this password check. Passwords are
cleared from the dialog after submission/cancellation and are never stored or audited.

`zzws_delete_customer` atomically locks the customer/team, verifies the owner session
and profile revision, revokes all sessions/invitations and marks all accounts deleted
and inactive. Removed customers disappear from the working list and assisted-order
selection. A database guard blocks reactivation by stale cards, imports or team access
endpoints. Historical account IDs, orders, report author snapshots and delivery data
are retained, including in application backups. A removed customer code may be reused
for a new customer; personal logins remain reserved by the historical account.

Migration: `supabase/migrations/20261101055050_client_deletion.sql`.
UI: `admin/client-deletion.js`; API: `admin/users/delete`.
Validation: isolated SQL/API tests cover permissions, mandatory/incorrect passwords,
revision conflicts, whole-team revocation, invitation invalidation, history/backup
retention and customer-code reuse. Browser tests cover cancellation, failed passwords,
persisted deletion, Armenian/Russian guides and the critical desktop/mobile layout.
Actual Supabase Auth is checked on temporary staging accounts which are then removed.
No real customer is deleted during publication checks; no production orders/mail are
created. Android package 7.1.12 remains the current release; this change is in the
web administration cabinet and API.

## Visible client catalogue access (published 1 November 2026)

The client's all-brands/category checkbox is now a large blue control at the top
of product access, with a live status and an orange notice for an empty permission
list. Choosing KP/Dealers preserves the separately configured all/selected and
excluded product rules. The read-only catalogue preview now permits POST only
for administrators with user-management permission. No existing customer product
permissions, prices, credentials or orders were changed by this fix.

Frontend commit `7eb87822c76190e194b559dc39bf0b1be4cc4d60`, successful Pages
workflow 41253277669; production API version 45. The full isolated client/team
browser workflow, category/access regression, desktop/mobile control checks and
preview permission tests passed. All four live frontend assets match the tested
files. Evidence: `work/client-catalog-fix/live-verification.json` and
`output/client-catalog-access/`.

## APK download accounting — 1 November 2026

The owner opens More → APK downloads to search accounts, select a release and
filter verified downloads, unconfirmed requests or missing data. Reports retain
inactive accounts and show each person's name/login, customer and last request /
confirmation dates in Yerevan time. Pagination is server-side, 50 accounts per page.

The private APK service records authenticated file/link requests. HEAD/current
checks never count. Only an account-owned receipt matching the saved attempt,
SHA-256 and byte count marks a download completed; retries preserve the first
completion time. Browser downloads acknowledge after local integrity checks.
Android 7.1.12 acknowledges after byte/hash/package/signer verification and retries
accounting independently of the installable file. Older apps can record requests
but cannot confirm completion. Drive downloads and pre-accounting history are not
reconstructed. A separately reported app version describes the last authenticated
session check; it does not imply a download receipt or an installation timestamp.

The client cabinet exposes the same authenticated primary APK download already
permitted by the server. Catalogue conditions and delivery variants are unchanged.
The report and the two new tables are owner/service-only; ordinary client users
cannot read other accounts' activity or acknowledge another account's download.
Both tables are included in encrypted application snapshots and restore checks.

Migration: `supabase/migrations/20261031231945_apk_download_tracking.sql`.
Deploy `zzws-api`, `zzws-apk`, website assets and Android 7.1.12 together. Both Edge
Functions validate revocable application sessions with gateway JWT verification
disabled. Evidence and rollout metadata are in `work/apk-download-tracking`.
Validation includes real SQL/API and actual staging Auth, browser downloads from
owner/client cabinets, both languages and guides, filters/pagination/mobile layout,
existing client-account workflows and 113 release unit tests. No production test
orders or customer emails are created during verification.

## Client accounts and report recipients (published 1 November 2026)

`client-accounts.mjs` separates the customer business code (`profile.customerCode`)
from each person's Auth login. The root client account is the customer manager;
employees reference it through `zzws_users.customer_id`. Personal name, surname,
phone and email live in `person`, separately from companyPhone/companyEmail.
A company card displays one shared phone and one shared email. Legacy contact
arrays remain stored so editing the new fields does not silently delete history.

Apply `supabase/migrations/20261031211228_client_accounts.sql` together with the
matching API, web assets and Android source. The migration retains existing user
IDs, Auth credentials, carts and historical orders. Only numeric legacy client
logins are copied to customerCode (including leading zeroes); named logins get
an empty business code for explicit administrator entry. Existing active clients
complete missing personal details at their next login without changing credentials.
Invitations open registration directly, expire after 48 hours, and are invalidated
after activation or replacement. Each recipient chooses a unique personal login
and password and must supply name, surname, phone and email. The form explains
that sales reports use these details. Syntax validation is not email ownership
verification. No automatic verification email was added.

Database triggers inherit the root profile into employee accounts on every root
change. Sessions also recheck root access; disabling a company blocks its team.
Memory stays per user. Managers can see all company orders, employees only their
own. Only managers can invite/enable/disable employees; administrators can inspect
the team and revoke employee access from the client card. Prices and customer
conditions remain administrator-controlled. Catalog versions include profile
revision, so changed conditions refresh in existing employee sessions.

All existing one, two or three client-card delivery variants remain selectable.
Selecting the organization automatically fills address and recipient contact in
separate fields. The existing editable delivery and draft rules are retained.
Personal employee contacts never replace delivery contacts. New orders snapshot
the actual author separately for sales reports; later profile edits do not rewrite
historical recipients. Manager history includes employee orders, with author-only
actions hidden for other team members' orders.

Reports use the order author's saved email automatically. Three configured copy
addresses stay in email settings and are not returned by report-options. Their
per-send toggle defaults to enabled; disabling it does not change settings or the
next report. Extra comma/semicolon-separated addresses are validated, normalized
and deduplicated independently. Delivery records retain actual recipients and
the toggle choice. Historical orders without an author retain an explicit legacy
recipient choice; authors are not inferred retroactively.

`client-team.js` provides the client cabinet, `admin/client-card.js` the team list,
and `password-setup.js` registration/personal completion. Android includes mandatory
personal completion, personal passwords, existing delivery variants and a manager-only team
entry through the existing authenticated website. Signed Android 7.1.11 (70111)
is published in the primary update channel; its certificate matches 7.1.10.
Installation on a physical device was not part of this publication.

Validation: 11 API/SQL tests, 16 browser suites, 19 Android debug management/role
checks and 113 release unit tests passed. Actual Supabase Auth registration and
team access were also exercised on temporary staging accounts and cleaned up.
All 36 published web assets and all 50 downloaded API files match the checked
source. The complete published browser workflow uses isolated SQL and an offline
mail transport: no real customer emails or production test orders were created.
Both complete guides have working section links and fully translated Russian
text, with Armenian/Russian switching preserving form values.

Published frontend commit: `f80d54a0891fe7b279a49834e875f40491499c3a`.
GitHub Pages workflow 41249801590 completed successfully. Production API version
44 includes the `client_accounts` migration. All 33 existing user IDs/logins and
client delivery variants, and all 4 existing order delivery snapshots, retained
their preceding checksums. Encrypted pre-release application backup:
`backups/server/ZZWS-2026-11-01_02-30-32.zzwsbackup`.
Verification is in `work/client-accounts-publication`; source changes, evidence
and release notes are in `output/client-accounts`.

## Named contacts, approval review deadline and Viber reminders (published 1 November 2026)

`admin/phone-card.js` displays up to five people, each as one row containing name,
phone and email. On narrow screens each person's fields remain together in a
bordered group. The separate client email rows have been removed from the card.
A separate manager phone is available for client cards and administrators' own
cards. The canonical `profile.contacts` records keep each person's fields together;
`contacts.mjs` validates names, phones and emails and derives compatible legacy
phone/email arrays. Phone normalization accepts international and Armenian local
notation and rejects duplicate numbers. A contact needs a name and at least a phone
or email; email-only people remain available for reports and are excluded from the
Viber recipient list. Existing legacy email groups are preserved; administrators
must enter names and review legacy phone/email pairings before saving the new card.
All data uses the existing revision-checked profile; no migration is needed. Older
card clients retain named contacts when they omit them and cannot overwrite a
named person's phone/email through outdated separate fields. Template-based card
copying does not copy contacts. Report recipient choices show name and email and
read addresses from these same person records.

`admin/approval-reminders.js` checks the existing server-side review deadline every
15 seconds while the administrator page is visible. Owner/manager accounts with
order-write permission get a persistent notice and an automatic modal once a
client's requested time expires. An active form input or another modal delays
opening. Returning to the page checks overdue orders immediately. The reminder can
be postponed five minutes in the current browser session and explicitly reopened
from the notice. A renewed client deferral, new proposal, or customer response
invalidates the old reminder on the next check.

The preparation endpoint rechecks order revision, proposal, deferral, pending state
and elapsed server deadline. It reads phone numbers from the current client card,
never delivery free text or the order's old customer snapshot. The reminder text
contains the order number and the client card's manager phone, falling back to the
acting administrator's phone. The recipient list shows name and phone. A single
Viber action prepares `viber://chat?number=<encoded-phone>&draft=<encoded-text>`;
the name and email are not added as routing parameters. Editing the recipient or
message immediately updates the prepared URI. The text is bounded to 2000
characters. There is no required copy/paste step. The application never sends the
message or marks it delivered; the intended final send remains inside Viber.
Missing phones or an empty message disable the action.

Ordinary personal Viber accounts were explicitly requested. Passing a draft to
their native chat URI is a compatibility attempt, not a verified public Viber
contract or a tested delivery guarantee. The official phone/draft Click-to-Chat
documentation applies to Viber Business accounts:
https://help.viber.com/hc/en-us/articles/36712478644381-Get-your-Viber-chat-link-and-QR-code-for-Business-accounts
An installed personal Viber on a real phone must still be checked for actual
recipient/draft population. Browser tests inspect and intercept the URI without
opening a real chat or sending a message.

The Android `PartnerWebActivity` allows only the exact validated Viber chat link
from a user gesture on the trusted website, routed explicitly to the Viber app.
The phone and draft are checked independently with size/encoding limits; other
Viber/intent URLs remain blocked. Android distribution is tracked separately in
`output/order-approval/release/`; the website/API publication alone does not
install an APK on a device.

Validation: `node --test tests/approval-reminders.integration.mjs
tests/customer-order-approval.integration.mjs` (4 passed), the existing
`tests/admin-persistence.integration.mjs` (passed), browser suites
`approval-reminders`, `admin-persistence`, `email-settings`, `admin-order-approval`
and `admin-navigation` (passed), and
Android debug Java/Kotlin compilation plus all 8 `PartnerPolicyTest` cases (passed).
API tests execute the real handlers and SQL against isolated invented data.
Browser checks cover five named-contact rows saving through the real API/SQL,
one desktop row per person's name/phone/email, recipient selection, one-click URI
containing the exact phone and full encoded message, mobile and desktop layout,
postponement/reload, response on another device and absent
phones. Screenshots: `output/approval-reminders/`. Android log:
`work/approval-reminders-android-test.log`. No messages were sent.

Published frontend: `09869c17044a2d2ab906649a37edd0ff73d8ad86` on
`patverparts-bot/ZZWS` main. GitHub Pages workflow 41240179739 completed
successfully. Production `zzws-api` is version 43 with migration
`20261031204231_customer_order_approval`. The live contact card, named email
recipients and Viber number/draft action were checked over HTTPS; the six relevant
downloaded API modules match the workspace. All 33 user profiles and 4 existing
orders retained their preceding checksums (excluding the newly added approval
columns). Encrypted application backup:
`backups/server/ZZWS-2026-11-01_00-36-36.zzwsbackup`. Verification:
`work/contact-reminder-publication/live-verification.json`. The isolated narrower
candidate was not deployed over the shared release, which already contained the
same tested contact/reminder implementation.

## Primary ZZWS 7.1.10 — 1 November 2026

The user promoted the Partner interface into the primary application. `android/`
is now the canonical source: package `am.zzws.admin`, versionCode 70110, original
release signer/Firebase registration and `zzws-apk` primary channel. This release
includes original icons, screenshots, system-bar insets, role-adapted management
and automatic background downloads. `android/README.md` documents behavior and
verification. `scripts/build-partner-icons.mjs` now generates primary resources.
Version 7.1.10 preserves the branded home feed and gives product lists a
scrolling context header with a compact bottom action row and on-demand search.
Version 7.1.9 removes ordinary-product fallback from Special Offers and aligns
promotion selection, labels, All and filters with the active account/WS/KP price.
Version 7.1.8 stabilizes management Back/Close, adds major catalogue departments
and an unfiltered All Products view, and fixes Armenian hob/hood bundle selection
in the APK's bundled dealer script.
Version 7.1.7 adds the website's favicon-based brand marks, with 31 bundled
images and asynchronous cached loading for other brands.
The prior source is `outputs/ZZWS-7.1.3-source-before-promotion.zip`.

The signed main APK is `outputs/ZZWS-7.1.10-production.apk`. The user explicitly
requested leaving the APK out of the update channel for now. The update service
was upgraded to allow active client readers while preserving owner-only fresh
confirmation for publication (production version 9 / staging version 1). Existing
release manifests remain unchanged. The downloaded production API 42 was audited:
orders/cart/mobile and three administration/mail integration suites pass; the
warehouse suite exposes the pre-existing unsupported `admin/warehouses` section.
Device installation and actual FCM delivery remain unverified.

## ZZWS Partner prototype history — 31 October 2026

`android-partner/` was the source of the separate `am.zzws.partner`
application (1.0.1, versionCode 10001). It retains the trial's Compose navigation
and product UI with the existing ZZWS brand assets. Native favourites now share
versioned account state, checkout selects lines in three stages, history search
retains its filters for pagination, and product facts use the current offline /
per-model refresh implementation. Current catalogue controls and purchase badges
are applied in the native catalogue.

The original native manager activity remains available. Additional functions use
`PartnerWebActivity` at the fixed website origin, with the current opaque session,
server permissions, Android document selection/export and printing. The tools
browser has no JavaScript-to-native interface. Cart handoff checks conflicts and
unresolved submissions, and reloads account state when returning to native UI.

Firebase has its own Partner Android registration in the existing ZZWS project.
`supabase/functions/zzws-partner-apk/` implements an independent updater using the
existing application-session contract and an isolated private storage bucket.
The original app/package/update channel and the website were not replaced by this
release. The first Partner APK was delivered through the owner's Drive; no
initial release manifest was published to the new update bucket yet.

Build with `android-partner/build.ps1`; validate/package with
`android-partner/package-release.ps1`. Full coverage and build details are in
`android-partner/README.md`. Release metadata is
`outputs/ZZWS-Partner-1.0.1-release.json`. The background updater uses Android
DownloadManager, a persisted fifteen-minute JobScheduler check and a dedicated
private FileProvider. No Update/Later dialog or browser download is used. Exact
length, checksum, package/version and signing identity are checked before a
user-initiated installer action. Foreground checks run every five minutes. The
production Partner update channel still requires its first owner publication.
Tests include 77 passed Android cases (one optional live-image request skipped)
and 18 update-handler cases using the real APK. Earlier isolated full API/SQL and
six browser handoff checks remain applicable to the unchanged work tools.
Signature, package, ZIP integrity, absence of private signing files and compiled
HTTPS-only policy were verified. No physical-device installation or actual FCM
delivery test was performed: the local emulator could not boot on this host.

The canonical Android project now lives in `android/` (7.1.3). Historical `work/*/android` copies are references, not sources for future releases. `android/build.ps1` uses the existing cached Android/JDK/Gradle tools, or `ZZWS_ANDROID_TOOLCHAIN`; signing configuration and DPAPI-protected keys stay in ignored `private-data/`. The local JSON test jar is a cached test dependency in `android/.toolchain/`. No build helper publishes or installs an APK.

The canonical Edge Function contains the released mobile/channel/delivery/calculation contracts together with the local dealer/catalogue/admin improvements. `scripts/unified-schema.mjs` lists the ordered clean installation SQL for isolated testing; it must not be replayed against an existing database. `tests/support/runtime.mjs` and `supabase-client.mjs` provide an offline-only SQL/Auth simulation; the real handlers and SQL run with invented records, with no external provider calls. PGlite 0.5.12 is declared in `tests/package.json`; this workstation can also use its existing cached package. Run `node --test tests/unified-api.integration.mjs` to exercise strict delivery/pricing, mobile settings, baskets, owned full-history search and pagination.

`scripts/build-product-specifications.mjs` generates the legacy full technical snapshot, bundled Android offline data, and individual `js/product-specifications/items/<SHA-256-of-exact-SKU>.json` files. The new web photo dialog requests only an individual file, keeps at most 40 cached model requests and displays selected main fields before expandable additional facts. Native Android reads its offline copy immediately and can validate/cache the matching model from the fixed public site URL; source URL, model identity and size limits are checked before replacement. Sources/verification dates retain their original meaning.

`tests/ui/optimized-usability.cjs` measures mobile navigation, checks the empty pending-orders state, server search parameters, refresh request coalescing, manager queue updates without draft mutations, and background-tab polling suspension. `output/optimized-version/index.html` is the captured local review gallery. `scripts/package-android-review.py` verifies the built version/assets/tests/signature and produces the local review APK and metadata in `outputs/`.

- `index.html`: page markup and external-library loading.
- `styles.css`: the original page styles.
- `js/core.js`: shared state and common helpers.
- `js/auth-data.js`: authorization, price-file loading and product parsing.
- `js/catalog.js`: filters, catalog rendering and product actions.
- `js/order-state.js`: cart, order modal and order history.
- `js/bulk-add.js`: bulk add by exact article code or partial model-name match.
- `js/order-submit.js`: order export, email/Viber text and final page event handlers.

The JavaScript files are classic scripts loaded synchronously in their listed order. This preserves the shared global functions used by existing inline HTML handlers. Keep that order unless the code is intentionally migrated to modules.

## Populated administrator order on narrow screens (local fix, 31 October 2026)

`admin/mobile-orders.css` adapts the manager workspace to its available content width using an inline-size container. Below 980 px of workbench content, the order queue and selected order are separate views. A selected order fills the available column and exposes `managerMobileBack` to return to the queue. Desktop split view remains available at wider sizes. The existing close-order action and its unsaved-edit/busy guards govern return to the queue; `zzws:admin-order-closed` clears the manager selection only after an accepted close.

The fix wraps long action captions (overriding the earlier forced `nowrap` on editor buttons), constrains headings and delivery fields, and confines wide line tables to their own scroll containers. It does not mask page overflow with a global clipping rule. Duplicate customer headings are omitted in the focused mobile view. Generic editing/sending instructions are hidden when the current order cannot be edited; closed-order proof and existing explicit reopening permissions remain intact.

Validation: `node scripts/check-dealer-release.cjs admin-manager-responsive admin-navigation order-races admin-workbench`. The responsive suite uses populated synthetic received/editable orders with long Armenian customer, address and product text at 320, 390, 660, 768, 980 and 1600 px. It verifies action bounds, zero page overflow, mobile list return, cancellation of unsaved-edit discard, read-only received orders and desktop split view. All four suites passed against mocked APIs, with no production order changes. Before/after evidence and screenshots are in `work/admin-mobile-layout/`. The fix has not been published.

## Administrator section Back navigation (local fix, 31 October 2026)

`admin/app.js` now creates a browser-history entry for each actual section change, restores sections on Back/Forward and normalizes direct fragment links without reloading the application or touching the session token. Initial entry provides a dashboard predecessor for a directly opened section. Repeated clicks on the active section and page reloads do not add duplicate entries. `adminBackSection` is a visible Previous section button and is disabled at the dashboard root. Both entry and restoration retain the existing section-permission checks. Restoring history while logged out cannot reopen the workspace. The existing forms/search state remain mounted during same-document navigation.

Validation: `node scripts/check-dealer-release.cjs admin-navigation order-races admin-workbench` with Playwright available. All three suites passed using mocked authenticated APIs and synthetic records. The navigation suite covers Back/Forward, internal Back, session preservation, retained search, duplicate entries, reload, restricted sections, actual logout and mobile layout. Evidence: `work/admin-navigation/`. This local fix has not been published.

## Three-step cart (local candidate)

`js/cart-checkout.js` and `.css` reuse the existing cart modal, saved carts, organisation/contact variants and order transports. Step 1 prepares the cart (catalogue/list addition, quantities and per-line selection); step 2 enters buyer/delivery details; step 3 displays the selected lines, current prices, buyer details and final send/export actions. Earlier steps do not submit or export orders. Contact and organisation are required; address is required for delivery. Step navigation keeps the existing draft fields and account memory.

Selection is per tab and defaults to all current cart lines. Unselected items remain in the cart. Shared email/Viber/Excel builders use the selected subset; printing uses the final review table. Final submission rechecks that the displayed lines, prices, price mode and buyer data have not changed, including after the asynchronous receipt-state check. Existing receipt limits and request-id retry protection remain. During submission, navigation, buyer fields and send/export controls are disabled. On success, only submitted lines still identical to their original cart snapshot are removed; unselected or concurrently edited lines remain. No API/database schema or live order changes are needed for this frontend candidate.

Run `node scripts/check-dealer-release.cjs` with Playwright available to verify the checkout, dealer workspace, assistant, catalogue settings, order races and receipt flows. `tests/ui/cart-checkout.cjs` checks subset submission/export, preserved drafts, validation, stale-price review, duplicate-submit prevention, retry IDs, remaining cart lines and mobile layout using synthetic data and mocked API responses. Checkout screenshots and test output are in `work/cart-checkout/`. The receipt regression checks quota unlock separately from the new step-dependent send-button state.

## Dealer workspace (local candidate, 30 October 2026)

- `js/dealer-tools.js` and `.css`: desktop table/cards, category-specific verified technical filters, product drawer, two-to-four-product comparison, customer presentation with editable sale prices, printable quotes, saved offers and bundle builder. Photo downloading, stock, reservation and delivery behavior are not added or changed.
- `supabase/functions/zzws-api/dealer.mjs`: authenticated `POST dealer/facts`, `dealer/details` and `dealer/bundles`, registered after the existing identity/password checks. Every request reprojects the current catalogue. Details accept at most four visible SKUs; facts contain no prices. Technical claims require the existing exact-name/SKU Zigzag snapshot match. Packaging/cup/wall dimensions are excluded from appliance sizes; explicitly labelled embedding/niche measurements remain separate. Missing facts stay unknown.
- Bundle recipes: oven/hob/hood, washer/dryer, TV/soundbar. Suggestions use completed/received client orders across the entire available server history, including older orders, with no date cutoff. Repeated lines and large quantities count once per order. A suggested exact composition needs at least three orders from three distinct clients. Up to eight historically frequent visible candidates per recipe slot are evaluated; up to four supported combinations are returned. Admin/rejected/unfulfilled orders are excluded. Historical scans use 500-row keyset pages and a five-minute per-isolate cache. Only current permitted models and the signed-in customer's current prices reach the browser; no identities, order IDs, other customers' prices or purchase counts are returned. Suggestions are not installation/connection compatibility claims. Insufficient evidence leaves the manual builder available.
- Up to ten saved selling offers, with up to twenty SKU/quantity/sale-price lines each, are validated under the existing `preferences.dealerOffers` memory section. This reuses account ownership, revisions, offline pending storage and encrypted application backups. Sale prices never override catalogue/order prices. Older clients that omit this field keep the saved offers on the server. No database migration is needed.
- Customer presentation is a native modal intended for a dealer to show on their own device, not a separate public account or share link. Its rendered content and printed output omit wholesale prices and margins. The native dialog covers/inerts the authenticated workspace; closing it returns to that workspace. Saved offers with unavailable products omit those products, and incomplete fixed-price bundles cannot reopen until rebuilt.
- Adding a bundle merges one unit per selected SKU into the existing cart at current prices and observes quantity limits. Changed prices/modes require reviewing the updated amount. No order is submitted automatically. User documentation is in `help/user-guide.html#guide-dealer`.
- Validation: `node --test supabase/tests/*.test.mjs`, `node --test tests/bulk-add.test.cjs`, and `node scripts/check-dealer-release.cjs` with `ZZWS_PLAYWRIGHT` pointing to Playwright. Browser suites use synthetic users/orders and mocked authenticated endpoints. The runner starts an allowlisted local asset server for the existing order suites. Screenshots and baseline copies are under `work/dealer-upgrade/` and `work/dealer-upgrade-baseline/`, never for publication.
- Deployment must include the matching Edge Function (including `dealer.mjs`, updated `replacements.mjs` and `memory.mjs`), frontend assets, cache versions and guide together. This candidate has not been deployed or tested against production purchase history. No account, order, pricing policy or live database was changed during development.

## ԶիգԶագ assistant

- `js/zigzag-armenian.js`: Armenian presentation labels for common technical specifications and values, preserving original source values and filtering.
- `zigzag-avatar.svg`: original blue zigzag mascot, shared by the launcher and chat.
- `js/zigzag-assistant.js` and `.css`: accessible chat dialog, Armenian UI, per-tab conversation, source cards, two-product comparison and explicit source refresh. Product rows open the assistant with the exact article code. Logging out discards the conversation and cancels pending requests.
- `supabase/functions/zzws-api/assistant-routes.mjs`: authenticated `POST assistant/chat`, registered after the existing identity/password checks. Every request projects the current catalogue for that user before searching. Per-isolate limits are best effort (15 requests/minute, 2 concurrent); they are not shared provider-quota enforcement.
- `supabase/functions/zzws-api/assistant.mjs`: exact-SKU/model retrieval, source validation, optional Zigzag refresh and optional Gemini Free Tier integration. Product claims use only verified Zigzag technical data. Failed refreshes preserve the saved verification date and display their saved status.
- `supabase/functions/zzws-api/advisor.mjs`: local conversational product selection without an AI API. It retains validated requirements between turns, asks one clarifying question at a time for ambiguous dimensions or an unspecified low budget, and offers exact-size products before nearby sizes (policy below). A complete request goes directly to offers. If nothing matches, the user chooses a requirement to change; the other requirements remain in force. Technical filters use only exact-model Zigzag specifications. Unlabelled dimension order, absent prices and unconfirmed requirements never become asserted matches. Examples: “Мне нужна недорогая стиральная машина, 60 сантиметров” → width/depth clarification → budget → offers; “Стиральная машина ширина 60 см до 200000 драм” → offers immediately.
- `supabase/functions/zzws-api/assistant-knowledge.json`: server-only public specification snapshot. It includes no wholesale prices, credentials, customer data or manufacturer-only specifications. The initial export includes 6,970 exact-SKU verified Zigzag products checked on 30 October 2026; current catalogue names must still match before use.
- `scripts/build-assistant-knowledge.py`: rebuild the snapshot from the existing verified enrichment pipeline with `python scripts/build-assistant-knowledge.py`. Refresh the enrichment first when updated source data is required; this exporter does not contact the website. Deploy the rebuilt JSON alongside the Edge Function.

User requirement: the assistant must not require paid plans, paid APIs, credits or trial balances. Search, source cards, saved specifications and comparisons work without an AI key. Do not activate billing, purchase services, or automatically switch to paid providers/models when a free quota runs out.

Selection state contains only bounded preferences (`advisor` in the request/response), is kept in the tab's memory, and is discarded on logout/new conversation. It conveys no catalogue permissions or trusted prices. Each selection searches the freshly projected catalogue on the server. Offer prices come from that catalogue with an explicit customer/retail label; technical data and source dates come from Zigzag. The model integration never receives the offer prices. Supported first-version preferences include category, AMD budget, maximum width/depth/height, load capacity, brand, drying and explicit inverter requirements, with Russian/Armenian/English phrases. Other wording may still require clarification; this is not unrestricted language understanding. Dimension units are converted only when the source specifies the units and axis order (for example H×W×D). Verify with `node --test supabase/tests/advisor.test.mjs`.

Optional generated answers use only `gemini-3.1-flash-lite`, listed with free input/output on Google's pricing page checked on 30 October 2026. Create a dedicated Google AI Studio Free Tier project with NO linked billing account; configure its key in the server secret `ZZWS_ASSISTANT_GEMINI_KEY`. Set `ZZWS_ASSISTANT_GEMINI_FREE_TIER=true` ONLY after verifying that project's Free Tier and billing status in AI Studio. Both settings are required; a key alone leaves AI disabled. The confirmation is an operator assertion, not an API check: the model endpoint cannot reveal or enforce account billing. Never enable billing on this project; disable/remove the key first if its tier changes. The old OpenAI secrets and configurable model have been removed from the assistant.

The Gemini request contains only the current question and at most two visible products' public technical specifications, with no catalogue prices or account details. Google may use Free Tier prompts/responses to improve products, so do not supply confidential data. No paid grounding, search, caching or other tools are requested. Quota errors, disabled models, timeouts and incomplete responses immediately return the verified cards with an availability notice; there is no provider retry or paid fallback. Free quotas, available models and regional availability may change; do not promise unlimited AI. Until a Free Tier key is configured, model integration is verified with mocks only and is not active.

Use existing hosting/database infrastructure within available free quotas; no new paid hosting or database plan is required by this feature. The current project's actual billing plan has not been changed or audited. Larger usage must degrade or wait for a quota reset rather than auto-upgrade.

Deployment requires the updated frontend, avatar, new server modules and JSON snapshot together. The legacy Flask server serves the UI assets but the assistant endpoint belongs to the existing Supabase backend selected by `js/api-config.js`. On 30 October 2026 the assistant was deployed as `zzws-api` version 26, preserving all files from production version 25. The frontend release is commit `b920450097573488c71068941e87cabad371a3c8` on `patverparts-bot/ZZWS` main. It adds only the assistant assets and minimal HTML/catalog/logout integration on top of the current production frontend; later unrelated administrator updates were preserved. The exact deployed candidate, preceding server bundle and verification report are in `work/assistant-publish/`. No database schema, billing or model-provider secrets were changed; the deterministic advisor works without a model key.

Validation: `node --test supabase/tests/assistant.test.mjs`; browser checks: `node tests/ui/assistant.cjs` (starts its own local test server; requires Edge and Playwright via `ZZWS_PLAYWRIGHT`). The browser test uses real saved specifications with mocked authenticated catalogue/API calls and simulated upstream failures, without calling AI services. Official references: https://ai.google.dev/gemini-api/docs/pricing, https://ai.google.dev/gemini-api/docs/billing, https://ai.google.dev/api/generate-content and https://supabase.com/docs/guides/functions/secrets.

The assistant interface is Armenian-only: no language picker, Armenian buttons, prompts, summaries and fallback answers. The frontend explicitly requests `locale: "hy"`; queries may still be written in Russian, Armenian or English. This locale is validated server-side and pins advisor questions and generated-answer instructions to Armenian. Product brands/models and unrecognized source terminology retain their original spelling. The mascot and chat accents use blue tones with dark navy details.

Assistant product cards use the catalogue's existing `getProductImageHtml` SKU photo map and image-error fallbacks. Each card offers an Armenian quantity field and Add to basket action. These call the existing `addToCart`/`setDirectQty` functions, preserve existing quantities, use the current permitted catalogue price (including the administrator's active price mode), and synchronize catalogue controls and user memory. Actions recheck the signed-in identity, current product visibility, orderable price and quantity limit at click time; they never submit an order. No new image service, backend endpoint or paid service is required.

The assistant opens in a centered, wide dialog on desktop and fills the screen on phones. Recommendation cards contain photos, current prices, dimensions and basket controls. “Բոլոր բնութագրերը” opens a separate product-details dialog with the full specification table and one scrolling body. Opening/closing details preserves the conversation, selection and quantities; adding from either dialog synchronizes the shared basket.

`supabase/functions/zzws-api/size-matching.mjs` defines category-specific search bands in centimetres (width/depth/height): washer 3/5/2, dryer 2/5/2, dishwasher 1/3/2, fridge 5/5/5, TV 5/2/5, laptop 2/2/0.5, microwave 3/3/2, coffee machine 2/3/2, vacuum 3/3/3, kettle and iron 2/2/2. These are search heuristics, never installation clearances. A target dimension ranks exact matches first (0.01 cm numerical tolerance), followed by nearby models ordered by normalized size difference, then permitted price. Up to three exact and three nearby offers are shown in separate Armenian groups; nearby cards identify each changed axis and its signed difference. Small-product bands are capped at 15% of the target, with a 0.5 cm minimum cap. Missing verified dimensions are not guessed.

Explicit maximum/minimum/exact dimensions and niche/opening limits stay strict; budget, capacity, brands and catalogue permissions remain mandatory. Validated preference state stores per-axis modes (`target`, `max`, `min`, `exact`). Legacy conversations without a mode retain `max`, because the earlier dialogue asked for a maximum; starting a new selection uses target-size semantics. Matching and dialogue tests: `node --test supabase/tests/*.test.mjs`; responsive dialogs, details/basket synchronization and Armenian presentation are covered by `tests/ui/assistant.cjs`.
Latest readability/size-search release on 30 October 2026: API version 29; frontend commit `12adbce41b4a4a8c73634fd1d2d26069ad6aa8d6`, rebased onto current production `630d69618e5a0e2b7352c81248f64b334c976f3a` to preserve concurrent catalogue-memory/help updates. Candidate and release metadata: `work/assistant-readable-release/`. Verification: all 119 server tests and the updated browser suite passed; browser checks use a mocked authenticated API. Public assets and unauthenticated API startup are checked separately by `verify-live.ps1`.

The subsequent orderability release prioritizes offers that have a positive permitted order price before all retail-only reference offers. Within each availability section, exact dimensions precede nearby dimensions. Server selection reserves up to three exact and three nearby orderable slots plus up to three reference offers, so low retail prices cannot displace orderable items. Reference-only cards are marked `orderability: {status: 'manager', reason: 'order_price_missing'}` and appear under “Ճշտել մենեջերի հետ”; the card and details explain in Armenian that price and ordering must be checked with a manager. Retail prices are explicitly informational; quantity and basket buttons are hidden until a valid current order price exists. The UI independently partitions by the shared basket's actual permitted price, rechecks at click time and preserves quantity limits. This does not assert stock availability. The request may select KP mode only for an authenticated administrator; clients always use the server-projected customer price, regardless of supplied mode or options. Unpriced products still cannot be claimed to satisfy a budget.

Orderability release on 30 October 2026: API version 30 and frontend `6cf7b428f279d391337aff661f6ca76167e1cc8d`; deployment candidate and metadata are in `work/assistant-orderable-release/`. All 122 server tests passed. Browser regression checks cover a deliberately shuffled response with cheaper retail-only exact matches, orderable nearby matches, Armenian explanations in cards/details, manager-only results, responsive layout and existing shared-cart safeguards. These checks use mocked authenticated endpoints; production asset content and API authentication are verified separately.

The manager-contact/public-reference release adds “Կապվել մենեջերի հետ” and “Պատճենել հարցումը” to manager-only cards and their details. The email link opens a draft addressed to `levon.grigoryan@zigzag.am`, the active administrator reply-to address checked on 30 October 2026; it never sends automatically. Its Armenian text includes the model, exact article code and validated Zigzag source URL, with no customer details, cart contents or prices. Copying uses the browser clipboard with an Armenian success/failure notice. The contact address is a public business contact constant in the assistant frontend; update it when the configured manager changes.

`scripts/build-assistant-public-catalog.py` builds `assistant-public-catalog.json`, a server-only index of 908 verified snapshot SKUs in the supported appliance categories. It emits only a SKU and canonical appliance type, discarding internal category labels and all other enrichment fields. `public-catalog.mjs` joins that allowlist to the existing verified snapshot, validates its source/date/type and takes brand only from the public Manufacturer specification. It never reads unprojected catalogue rows. The server continues to project current user prices/permissions separately; an outside-catalog reference receives no price, stock or order permission. Visible SKUs are deduplicated from public suggestions. Exact/near dimensions, brand, capacity and feature requirements still apply; an unknown public price is explicitly marked as unconfirmed against the budget.

Responses return up to three `publicRecommendations` in a separate final section “Ձեր կատալոգից դուրս մոդելներ”, after orderable and manager-only catalogue offers. They are marked `catalogScope: 'public'` and `orderability: {status: 'manager', reason: 'outside_catalog'}`. These references can still appear when the current user's catalogue has no matching category. Their photos use existing public Zigzag image fallbacks; the full verified specs open locally in the details dialog. Public references cannot be added to the basket. Explicit SKU lookup/comparison/refresh and ordering continue to enforce the existing catalogue boundaries; this change broadens conversational technical suggestions only. Snapshot checks retain their original dates and do not promise live inventory or a full live-site search.

Manager/public release: API version 31, frontend commit `80dd871b5a79833c11a9009b2ef8104920acae79`, preserved latest main `e50781681a175f2a00231197cc274580c1a74277`. Candidate, verification script and metadata: `work/assistant-manager-public-release/`. Validation: 127 server tests; browser checks include exact model/SKU/source in email and copied text, clipboard-error handling, public references with zero basket controls/private prices, photo/details rendering, budget notices and responsive layouts. Browser authenticated API calls are mocked. No emails were sent during verification; no schema, billing or provider-secret changes were required.
