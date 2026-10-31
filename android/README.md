# ZZWS — primary Android application

Version 7.1.11 (70111), package `am.zzws.admin`, Android 8+. This is the canonical
application as of 31 October 2026. The former Partner interface is now the primary
ZZWS interface. Future Android changes belong here. `android-partner/` is a
separately installed prototype/reference and is no longer the primary target.

The application retains the original package, release certificate, Firebase
registration, encrypted-session store and primary `zzws-apk` update channel.
An APK can therefore update the existing original ZZWS installation; the separate
`am.zzws.partner` installation cannot be updated across package identities.
The previous 7.1.3 source is preserved in
`outputs/ZZWS-7.1.3-source-before-promotion.zip`; its signed APK is retained too.

## Client accounts — 7.1.11

Each client manager and employee has personal credentials and contacts. Existing
clients complete missing personal details before opening the catalogue. Delivery
continues to use the selected original client-card variant and its recipient
contact. Managers can open the authenticated team cabinet through the website.

## Interface and behavior

7.1.10 keeps the branded home feed, campaigns, brand strip and department
previews. Catalogue/search results/favourites use a separate layout: the app
branding bar is absent, and the department title, count, query and selected
customer are the first scrolling grid item. They leave the viewport naturally
when scrolling; no pinned search field, category strip or extra toolbar sits
above products. Busy state is a thin overlay rather than a reserved content row.

A single 56dp bottom row offers Departments, Filters (including sorting), Search,
Compare, Cart and Menu. It owns bottom/horizontal safe drawing insets and never
overlays cards or the phone navigation controls. Menu retains Home, Profile,
Favourites, notification settings, refresh, language and management. Search opens
an on-demand bottom sheet with keyboard/IME Search and an explicit submit button.
Closing it discards the draft and preserves browsing; submitting starts a global
catalogue search. Explicit department/query/filter changes return the grid to
the top, while normal automatic catalogue refresh keeps the browsing position.
The home-page search entry opens the same sheet so the first typed character
cannot navigate away from the field. Approval reminders wait while it is open.

Optional native Compose UI checks: `./android/test-catalog-ui.ps1` once to fetch
its test dependencies, then `-Offline`. Outputs are isolated under
`android/build-catalog-ui` with a separate project cache, and test libraries are
not production dependencies. All six native UI scenarios pass at 320/360dp: home content, header-free product
viewport, scrolling header, search submission, cancelled draft and narrow-phone
controls. Evidence: `output/primary-7110/catalog-chrome-ui-tests.xml`. These use
Robolectric layout/semantics with legacy graphics, not a physical phone.
The public customer-code selection contract is retained; its old login-based
regression fixture and field label were brought into line with that contract.
Release builds may also use `./android/build.ps1 -BuildDirectory build-primary-7110`
and `python scripts/package-android-review.py --build-directory build-primary-7110`
to avoid concurrent build-output collisions. Default commands keep using `build`.

7.1.9 makes Special Offers use only the server's promotion flags for the active
account/price context and a positive selected price. KP-only campaigns do not
mark WS prices; a customer's server-projected promotion belongs to that
customer's displayed account price. Retail campaigns are explicitly labelled
Retail promotion, separately from account/KP promotions. A normal difference
between retail and wholesale prices is never itself a promotion. The home page
previews up to six eligible products, with All opening the same full eligible
set. The filter preview count and card/detail labels use the same policy. If
there are no eligible offers, the section and offers shortcut disappear; the
generic collection banner leads to the catalogue. There is no ordinary-product
fallback under Special Offers. The normal catalogue refresh updates this block
as campaigns appear/expire in the server response. Prices/API publication rules
are unchanged; this is not a manually curated admin Offers feed. Six new policy
regressions cover empty campaigns, WS/KP separation, customer projection, retail
labels, invalid prices and preview/filter consistency.

7.1.8 gives embedded management its own visited-section stack. System/toolbar
Back first dismisses the active dialog or More menu, then returns through visited
sections; a tool root and Close return to the native management hub. Returning
from the hub leads to Profile. The auth bootstrap is never a Back destination.
AndroidX lifecycle-aware Back callbacks replace manually registered platform
callbacks. WebView is detached before destruction, without navigating to another
page during teardown; late callbacks and repeated taps are ignored. A renderer
failure returns to the hub instead of terminating the app. Native order history
returns to its order, and the order list returns to the hub without signing out.
Ten Robolectric lifecycle/navigation regressions and seven browser scenarios
pass. Run `./android/test-management.ps1 -Offline` with the cached toolchain.
See `output/primary-718/` and `tests/ui/partner-navigation.cjs`.

The catalogue opens with major departments (TV, refrigeration, washing, cooking,
etc.) and counts, rather than hundreds of raw categories. Detailed categories
remain inside their department and in explicit filters, without the old first-30
shortcut limit. All Products clears presentation filters and exposes every row
returned by the account's catalogue endpoint. Brand/promotion shortcuts also
start with clear filters. Counts show visible versus loaded rows. A new search starts across all departments.
The catalogue reloads on ordinary foreground return and checks `catalog/version`
every 60 seconds while the application is resumed. A changed price/rules/control
version loads the complete catalogue silently; an unchanged version gets a full
refresh every five minutes to cover account-access changes. Offline failures
retain the last complete list and retry at the next tick. Updates are discarded
if the active account/customer context changes or checkout starts during a
request. Search, filters and basket quantities remain in place. A toolbar refresh is also
available. Checkout and uncertain submissions retain their frozen data. The
reported SKU 510078 (Bosch BFL524MB2) was confirmed in the current production
price using a read-only lookup and is covered by exact-code/model/department tests. Classification
is exhaustive, with an Other group for new/unnamed categories. Tests reconcile
all 7,237 rows and 402 categories from the local source price's category counts;
this is not a claim about the user's current live catalogue. Server account,
price and stock access rules continue to define the API's catalogue response.

Kitchen bundle selection now recognizes the actual Armenian source categories
`Ներկառուցվող (Գազօջախներ)` and `օդաքարշ պահարաններ`, excluding accessories.
The same categories can be selected even with older server facts marked Other;
technical compatibility and dimensions are not inferred. The APK bundles
`js/dealer-tools.js` and serves it only for that exact same-origin script in
embedded tools, so the Android fix needs no website/API deployment. The build
syncs the asset and packaging verifies byte equality. Browser tests select both
models and add the complete set to a local test cart, without submitting orders.

7.1.7 restores brand marks on the home page, product cards/details, comparison
and brand selection. It mirrors the website's `js/core.js#getBrandLogoHtml`:
the same 30 brand-domain mappings, domain fallback and Google S2 favicon URL.
31 marks from that source are bundled, including all 12 demo brands. Other marks
load asynchronously without account headers and stay in bounded memory/disk
caches. Full brand captions remain available if loading fails; no backend change
or new permission is required. `scripts/sync-android-brand-logos.py` regenerates
the Android mapping and bundled PNGs from the website source (Python/Pillow and
network required). `output/primary-717/brand-logos.png` reviews actual bundled
assets; it is not an Android device screenshot.

7.1.6 fixes opening delivery/history date pickers. The locale override now uses
an Activity-backed ContextThemeWrapper rather than a detached configuration
context, preserving the Activity's WindowManager/token and theme. An isolated
Robolectric regression caught the old lost-window-service behavior; all five
calendar tests now pass (Armenian/Russian selection, leap day, cancellation and
wrapped Compose-style contexts). Run `./android/test-calendar.ps1` once to fetch
test-only dependencies, or `-Offline` with the cached toolchain. The opt-in
`zzwsCalendarRegression` property keeps Robolectric out of production dependencies.
Evidence: `output/calendar-716/before.xml` and `after.xml`. This test environment
does not substitute for a test on the user's physical phone.

7.1.5 compacts each native toolbar to one 48dp row while preserving system-bar
insets and 48dp button targets. Manager branding/language/status no longer occupy
several fixed rows; status belongs to the scrollable content, with a thin busy
indicator and toast errors. The catalogue's general messages use a snackbar
instead of a pinned text block. Embedded administration hides the duplicate site
header and section trail and keeps its menu to one row at 320/390px widths.

The native catalogue, cards, comparison, checkout, orders and profile share the
ZZWS palette and 25 original vector glyphs, including one profile alias. The new
launcher has a navy background, a blue module and the existing white ZZWS mark;
adaptive, monochrome and notification resources are included. Edit
`scripts/build-partner-icons.mjs`, then run it to regenerate primary resources.
The exact-vector review sheet is `output/partner/icons-7.1.4.html`.

Screenshots are allowed in the catalogue, login, manager and embedded tools.
The header respects top/horizontal safe drawing insets. Material 3 NavigationBar
owns bottom/horizontal insets with no fixed total height. Manager and web-tool
roots apply system-bar/display-cutout insets. No system controls are hidden.

Management uses the same native shell/cards as the catalogue, with server scope
permissions, actual dashboard counts and filtered order shortcuts. Viewers get
read-only descriptions; price managers do not get order/customer operations.
Embedded administration uses the same colours, type, rounded controls and mobile
layout. Native order management retains its existing business requests. Leaving
order management returns to its parent instead of signing the account out.

Customer context is visible above native content. Choosing a different customer
outside checkout uses their catalogue; changing away from a nonempty customer
basket requires confirmation. Checkout retains selected-line submission, frozen
retry identifiers, encrypted pending requests and server quote/revision checks.

The former misleading Settings shortcut is labelled Work desk. Notification
preferences are explicitly labelled Notification settings. The first-login link
offers login help rather than promising a self-service password reset.

## Updates and release

New releases download automatically through DownloadManager, with a start
message/progress notification and no Update/Later or browser download. A persisted
JobScheduler check runs roughly every fifteen minutes, subject to Android's
background limits; active-app checks run every five minutes. Failed downloads
retry with a fresh signed URL after a fifteen-minute cooldown. Signing out
cancels downloads and jobs. A separate API client restores the encrypted token
for background checks without modifying the active UI session.

Exact length, SHA-256, package, version and installed signing identity are checked
before a private APK becomes installable. Installation opens only after a user
tap on the ready notification/profile action, with Android's confirmation and
unknown-source setting when needed. The primary update service supports active
client accounts as well as existing authorized administrators. Only an owner with
a fresh password confirmation can publish. No storage policies were broadened.

Build: `./android/build.ps1`. Package/verify:
`python scripts/package-android-review.py`. Release signing uses the existing
DPAPI-protected key; private credentials never enter the APK. Current artifact:
`outputs/ZZWS-7.1.10-production.apk`; metadata:
`outputs/ZZWS-7.1.10-release.json`. The update service is
`supabase/functions/zzws-apk/` (production version 9, staging version 1).

**The user explicitly chose not to publish the new APK into the update channel yet.**
The APK is available in the owner's Drive. Existing published APK manifests were
left unchanged. Publishing the binary later uses the owner's existing APK form.

## Audit and limits

The server audit uses a freshly downloaded production API 42, executed with
invented data in isolated SQL. Catalogue/orders/cart/mobile and three admin/mail
integration suites passed. The warehouse suite fails because deployed API 42
does not implement/authorize `admin/warehouses`, despite the website's section.
This is a known existing backend gap, not a passing feature. No production
customer records, orders, emails or reports were changed by verification.

Android tests: 112 cases, 111 passed, one optional public-image network request
skipped. Update-handler tests: 18 passed with the real signed APK. Browser checks:
11 passed, including the actual saved-basket/seller/technical/assistant handoffs,
management destinations, mobile layout and the primary publication channel label.
The vector contact sheet was rendered/inspected, including small/dark variants.

Comparison and demo data are local; comparison is not synchronized to the server.
The notification screen edits subscriptions, not a history of all push messages.
Native manager statistics cover its loaded/filtered results (up to 100), rather
than claiming to be a complete system report. Technical facts can use a bundled
snapshot with per-model refresh; that snapshot is not live inventory.

Physical-device installation, actual FCM delivery and an end-to-end device APK
update have not been verified. Local browser screenshots are labelled as web or
vector-resource reviews, never as screenshots from an Android phone.

## Play Protect incident

The user reports that Google Play Protect blocks 7.1.4 as potentially harmful;
the expanded message supplies no specific category. The APK signature, release
identity and ZIP checks pass, but these are not malware clearance. Defender's
custom scan returned 0x80508023 without a verdict. The 7.1.5 header fix does not
establish that Play Protect's classification is resolved. A factual review draft
and incident metadata are in `output/primary-714/play-protect-review.*`. No APK
has been submitted to VirusTotal or Google; user consent is required before
sending the APK to those third parties. Do not ask users to disable Play Protect,
rename the package or replace its signing key to evade classification.
