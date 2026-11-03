# Catalogue command panel

Search, filters and the existing catalogue workflows are available in one non-modal panel. The catalogue heading contains a named opener; when it scrolls out of view, a compact fixed edge button becomes available. The opened panel follows the viewport while the user scrolls the catalogue. Closing it reserves no sidebar width or sticky toolbar height. Escape, the close/done buttons, clicking outside or moving keyboard focus outside close the panel. No inactivity timers discard user input.

The actual existing search form, filter controls, tool buttons and sort controls move between their original home positions and the panel. They are not cloned. Their handlers, selected values, permissions, model matching and order logic remain intact. Existing proposal, list-picker and instruction dialogs open above the catalogue; the command panel closes before launching them. Search remains in the storefront header on the home page.

Cards use the released width rather than reserving a permanent sidebar. A wide table can occupy the full viewport height while scrolled, with its existing sticky headings and column sizing. Mobile cards retain their existing two-column layout. Armenian/Russian tab labels and keyboard navigation are supported; no animations are required for opening/closing.

Context help anchors are aligned with their section/field labels or actions. Hidden legacy sorting controls no longer leave an orphan question mark. The administrative dashboard's existing placement is retained.

Admin table warehouse availability is a small vertical ledger: one code per line, all quantities aligned on the right. There are no comma-separated wrapped pairs or large boxes. Client stock remains the server-projected availability text. Table thumbnails are 64×64 px instead of 32×32; original photo-opening handlers remain attached.

The article row uses a small external-site icon beside its copyable code. Clicking a model name copies its exact value with the same clipboard fallback and confirmation as the article. Card details remain available through a separate information control; table details retain their existing explicit link.

Validation: `tests/ui/catalog-command-panel.cjs`, existing proposal/customer checkout and stock-picker scenarios, table width/extra-column checks, and sticky header checks. The panel test covers preserved scroll position, open-panel scrolling, no persistent sidebar, help/input non-overlap, nested dialogs, warehouse values, thumbnail dimensions, client privacy and mobile overflow.
