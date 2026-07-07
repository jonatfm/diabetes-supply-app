# Diabetes Supply App: Project Analysis and Improvement Plan

Date: 2026-07-06

## Executive Summary

This project is a local-first Expo / React Native app for managing a private person's diabetes supplies at home. It is already shaped around the right core abstraction: real products are tracked as physical packs with individual expiry dates, remaining units, barcode metadata, history events, optional colored-dot labels, and holiday reservations.

The strongest parts of the project are:

- Pack-level inventory instead of only product-level stock counts.
- Local SQLite storage with Drizzle ORM and migrations.
- GS1 / EAN barcode-assisted onboarding.
- Session tracking for products such as CGM sensors.
- Holiday planning that snapshots calculated needs and reserves concrete units from concrete packs.
- Export/import backup support including product images.

The largest improvement areas are:

- Data correctness and transactional safety.
- Auditability of undo/discard/manual changes.
- Completing notification functionality.
- Stronger validation and duplicate prevention.
- Generalizing the domain from diabetes-specific supplies to private medical/home inventory.
- Better test coverage for the business rules, especially stock mutation, GS1 parsing, and holiday reservation logic.
- UX polish around empty states, recovery flows, scan failures, pack editing, and emergency planning.

This document explains how the app works today, lists issues found during project exploration, and proposes a prioritized roadmap.

## How The Project Works

### Technology Stack

The app is built with:

- Expo and React Native.
- Expo Router for file-based navigation.
- React Native Paper for Material-style UI components.
- TanStack React Query for data fetching, caching, and invalidation.
- Expo SQLite as the local database.
- Drizzle ORM for typed schema access and migrations.
- Native Android modules for image/barcode processing.
- TypeScript throughout the application layer.

The app is intentionally local-first. There is no remote backend, no account system, and no cloud sync in the current codebase. All primary data lives in the device SQLite database, with backup/export handled through a JSON file.

### App Entry And Navigation

The root layout is [app/_layout.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/_layout.tsx). It:

- Ensures the database migrations are applied on native platforms.
- Creates a shared React Query client.
- Creates a React Native Paper theme from the system color scheme.
- Wraps screens in `ScanFlowProvider`, which stores the active scan result across screens.
- Defines the app stack routes.

The tab layout is [app/(tabs)/_layout.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/(tabs)/_layout.tsx). It exposes:

- Home / Inventory.
- Holiday screen, protected by the `holidayFunctionEnabled` app setting.
- Settings.

Most screens are wrapped by [components/AppWrapper.tsx](/Users/jonat/Projekte/diabetes-supply-app/components/AppWrapper.tsx), which applies a themed surface and safe-area padding.

### Database Initialization

The database layer is in [db/index.ts](/Users/jonat/Projekte/diabetes-supply-app/db/index.ts). It:

- Opens a single SQLite database named `db.db`.
- Creates a single Drizzle instance for the app lifetime.
- Runs migrations through `drizzle-orm/expo-sqlite/migrator`.
- Rejects database use on web because Expo SQLite is only configured for native platforms here.

The schema is defined in [db/schema.ts](/Users/jonat/Projekte/diabetes-supply-app/db/schema.ts). The current schema includes products, product identifiers, packs, stock events, sessions, colored dots, app settings, holidays, holiday pack lists, holiday pack allocations, and warning records.

### Core Data Model

#### Products

`products` represent supply categories, for example insulin pen needles, CGM sensors, lancets, test strips, infusion sets, or medication packages.

Important fields:

- `name`
- `imageUri`
- `unitsPerPackDefault`
- `active`
- `canHaveExpiry`
- `isSessionBased`
- `nominalSessionTimeDays`
- `useColoredDots`

Session-based products are things where one consumed unit starts an ongoing period of use, such as a sensor that lasts 10 days.

#### Product Identifiers

`product_identifiers` links scannable product identifiers to products.

Supported identifier types:

- `GTIN`
- `UDI_DI`
- `EAN13`

The scan flow uses these to decide whether a scanned barcode belongs to an existing product or should start a product creation/linking flow.

#### Packs

`packs` are the core inventory unit. A pack belongs to one product and stores:

- `expiry`
- `productionDate`
- `createdAt`
- `unitsRemaining`
- `ais`, a JSON object containing parsed GS1 Application Identifier values.
- `active`
- `dateSetManually`
- `rawCode`

This design lets the app distinguish multiple physical packs of the same product, choose the earliest-expiring valid pack, prevent double booking for holidays, and show serial/lot/expiry information.

#### Stock Events

`stock_events` are the inventory history. Supported event types are:

- `ADD`
- `TAKE`
- `DISCARD`
- `ADJUST`
- `UNDO`

Events store product/pack references, unit deltas, timestamps, related event/session IDs, notes, and optional metadata.

In practice, the app currently inserts `ADD`, `TAKE`, and `ADJUST` events. Undo currently deletes a `TAKE` event rather than recording an `UNDO` event, which is a major auditability gap.

#### Sessions

`sessions` track session-based products. When a session-based product is consumed, the app starts a session with:

- product ID
- pack ID
- start time

The user can later stop the session with an outcome:

- `completed`
- `failed`
- `removed_early`
- `lost`
- `unknown`

Statistics use session duration and time between sessions to estimate future needs.

#### Colored Dots

`colored_dots` stores available physical sticker colors. `colored_dot_assignments` assigns one or more dot IDs to a pack.

This is a practical feature for the real-world problem: when multiple identical-looking packs exist, the app can say "use the pack with the red and blue dots" instead of relying only on serial numbers.

#### Holidays

The holiday model has three tables:

- `holidays`: destination, duration, state, updated timestamp.
- `pack_list_for_holiday`: which products are needed and how much should be packed.
- `packs_for_holiday`: concrete pack allocations for a holiday.

Holiday states are:

- `PLANNED`
- `PACKED`
- `ACTIVE`
- `COMPLETE`

The important design choice is that `pack_list_for_holiday.calculatedAmount` snapshots the calculated amount when the holiday is created. That prevents a future usage-statistics change from silently changing an existing packing plan.

### Repository Layer

The repository layer under `src/data/*Repo.ts` contains direct database operations:

- [src/data/productRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/productRepo.ts): product creation, lookup, update.
- [src/data/packsRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/packsRepo.ts): pack listing, pack add, consume, manual edits, duplicate matching.
- [src/data/historyRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/historyRepo.ts): history lookup and undo.
- [src/data/sessionsRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/sessionsRepo.ts): session start/end/stat lookups.
- [src/data/holidayRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/holidayRepo.ts): holiday creation, activation, completion, reservation, and pack allocation.
- [src/data/statisticsRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/statisticsRepo.ts): usage estimates from take events and sessions.
- [src/data/coloredDotsRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/coloredDotsRepo.ts): dot creation, activation, assignment, unique combination generation.
- [src/data/appSettingsRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/appSettingsRepo.ts): settings key/value storage.

Hooks under `src/data/hooks` wrap these repositories with React Query.

### Inventory Home Flow

The home screen is [app/(tabs)/index.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/(tabs)/index.tsx). It:

- Loads all products.
- Allows product-name search.
- If there is an active holiday, groups products into "on current holiday" and "other items not with you".
- Opens a product detail page on product press.
- Provides a floating scan button.

The product cards are rendered by [components/ProductCard.tsx](/Users/jonat/Projekte/diabetes-supply-app/components/ProductCard.tsx).

### Scanning Flow

The scan screen is [app/scan.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/scan.tsx). It:

1. Requests camera permission.
2. Shows an Expo Camera preview.
3. Captures a photo.
4. Sends the image URI to `processImage` from the native `frame-processor-v2` module.
5. Reads the first detected barcode.
6. Detects whether it is GS1, EAN13, or unknown.
7. Extracts a product identifier.
8. Stores the scan result in [state/scanFlow.tsx](/Users/jonat/Projekte/diabetes-supply-app/state/scanFlow.tsx).
9. Looks up the identifier in the database.
10. Routes either to existing-product pack addition or product creation/linking.

Manual barcode input follows the same parser and routing path.

The GS1 parsing code is in [scripts/gs1.ts](/Users/jonat/Projekte/diabetes-supply-app/scripts/gs1.ts). It supports:

- Human-readable GS1 strings with parentheses.
- Raw concatenated GS1 strings.
- Some FNC1-separated parsing.
- Core AIs such as `01` GTIN, `10` lot, `17` expiry, `21` serial, and `11` production date.

### New Product Flow

When a scanned identifier is unknown, [app/new/choose_existing_product.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/new/choose_existing_product.tsx) lets the user:

- Link the scanned identifier to an existing product.
- Create a new product.

The new product screen is [app/new/new_product.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/new/new_product.tsx). It collects:

- Product name.
- Whether expiry dates apply.
- Whether the product is session-based.
- Nominal session duration.
- Whether colored dots should be used.
- Units per pack.
- Optional product photo.

After saving the product and identifier, the app routes to the add-pack screen.

### Add Pack Flow

[app/new/add_pack.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/new/add_pack.tsx) uses the scan context and product defaults to create a physical pack.

It:

- Shows parsed expiry when available.
- Requires manual expiry if the product can expire and no scanned expiry was found.
- Lets the user adjust units in a partially used pack.
- Validates that units are positive and not greater than the product default.
- Generates or displays colored-dot assignments when enabled.
- Calls `packsRepo.addPackWithStockEvent`.

`addPackWithStockEvent` inserts:

- A row in `packs`.
- A corresponding `ADD` row in `stock_events`.
- Optional colored-dot assignment.

### Product Detail Flow

The product page is [app/product/[id].tsx](/Users/jonat/Projekte/diabetes-supply-app/app/product/[id].tsx). It is the main operational screen.

It displays:

- Product image and metadata.
- Stock total.
- Expiry warnings.
- Session status.
- Days until out of stock.
- Holiday packing card when relevant.
- Last consumed item for GS1 products.
- Pack table with serial/code, units, expiry, and dots.
- Statistics and history.

The "Consume item" action:

1. Fetches active non-empty packs.
2. If an active holiday exists and the product is on it, restricts selection to holiday-allocated packs.
3. If not on holiday, subtracts units reserved by active/planned/packed holidays.
4. Filters expired packs out.
5. Sorts by expiry or fewest units.
6. Shows a confirmation dialog with exact pack information.
7. Calls `packsRepo.consumeOneUnit`.

`consumeOneUnit`:

- Checks the pack exists and has units.
- Starts a session when the product is session-based.
- Decrements `packs.unitsRemaining`.
- Inserts a `TAKE` stock event.
- Decrements any active holiday allocation for that pack.

The page also allows:

- Stopping an active session with an outcome.
- Discarding expired packs.
- Opening product settings.
- Editing pack units/expiry/dots.
- Undoing the last take action.

### Pack Editing Flow

[app/product/edit/[id].tsx](/Users/jonat/Projekte/diabetes-supply-app/app/product/edit/[id].tsx) supports manual pack edits.

It lets the user:

- Change remaining units.
- Change expiry date.
- Assign or regenerate colored dots.
- Inspect GS1 AI fields and pack metadata.

Manual unit/expiry changes are saved through `packsRepo.manualDataUpdate`, which updates the pack and inserts an `ADJUST` stock event with before/after metadata.

### Product Settings Flow

[app/product/settings/[id].tsx](/Users/jonat/Projekte/diabetes-supply-app/app/product/settings/[id].tsx) lets the user:

- Rename a product.
- Change product photo.
- Toggle colored-dot use for that product when globally enabled.
- Open a scan flow for adding colored-code/dot support.

Currently this settings page does not expose all product fields. For example, it does not allow changing `unitsPerPackDefault`, `canHaveExpiry`, `isSessionBased`, or nominal session time after creation.

### Statistics And Estimates

Statistics live in [src/data/statisticsRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/statisticsRepo.ts).

For non-session products:

- The app calculates the average time between `TAKE` events.
- Intervals containing an `ADJUST` event are skipped.

For session-based products:

- The app calculates average session duration.
- It also calculates average time between an older session ending and a newer session starting.
- The estimated duration per item is session duration plus gap between sessions.

The days-until-out-of-stock hook uses these averages with current stock totals.

### Holiday Planning Flow

Holiday planning begins at [app/holiday_mode/plan_holiday.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/holiday_mode/plan_holiday.tsx).

The user enters:

- Destination.
- Number of days.
- Products to bring.
- Calculation method for each product.

Supported methods:

- Average daily usage plus percentage buffer.
- Average daily usage plus fixed buffer.
- Fixed amount.
- Per day.
- Per day plus buffer days.

When the holiday is created, [src/data/hooks/useCreateHoliday.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/hooks/useCreateHoliday.ts) computes snapshot amounts and `holidayRepo.createHoliday` stores them.

Holiday needs are calculated in [src/utils/calculateHolidayNeeds.ts](/Users/jonat/Projekte/diabetes-supply-app/src/utils/calculateHolidayNeeds.ts).

The simple calculation returns product target amounts. The full calculation:

- Loads target amounts.
- Subtracts units already packed for this holiday.
- Skips packs already packed for this holiday.
- Subtracts units reserved by other active/planned/packed holidays.
- Recommends earliest-expiring active non-empty packs.

### Holiday Packing Flow

[app/holiday_mode/pack/[id].tsx](/Users/jonat/Projekte/diabetes-supply-app/app/holiday_mode/pack/[id].tsx) displays a grid of products and progress toward required units.

When the user taps a product, the app shows the exact pack to take from, including:

- Serial/code.
- Expiry date.
- Units left.
- Units reserved for other holidays.
- Colored-dot labels.

When the user confirms packing, `holidayRepo.addPackToHoliday`:

- Validates that the physical pack has enough unreserved units.
- Inserts a `packs_for_holiday` allocation with both current `units` and immutable `originalUnits`.

The holiday auto-transitions to `PACKED` when all product targets are met. It can later be activated with `Go!`. While active, consumption is constrained to the products/packs assigned to that active holiday.

### Settings And Backup

The settings screen is [app/(tabs)/settings.tsx](/Users/jonat/Projekte/diabetes-supply-app/app/(tabs)/settings.tsx). It includes:

- Notification toggles and thresholds.
- Colored-dot management.
- Holiday function toggle.
- Export backup.
- Import backup.
- About card.

Export is implemented in [src/data/hooks/useExportDatabase.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/hooks/useExportDatabase.ts). It exports products, identifiers, packs, events, sessions, colored dots, assignments, app settings, and product images as base64 in JSON.

Import is implemented in [src/data/hooks/useImportDatabase.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/hooks/useImportDatabase.ts). It validates backup version 1 or 2, restores images, deletes current table data, inserts imported data, and invalidates React Query.

## Current Strengths

- The app solves a concrete private-home medical inventory problem, not a generic CRUD demo.
- The physical-pack model is the right foundation for safety-sensitive supply tracking.
- Holiday planning is more rigorous than a simple checklist because it reserves concrete units.
- The app handles session products, which matters for CGMs, infusion sites, and similar supplies.
- The use of GS1 AI data can make expiry, lot, and serial tracking reliable.
- Backup/import support is already present, including images.
- Colored-dot labeling is a clever low-tech bridge between digital inventory and physical storage.
- The README is useful and accurately describes the major feature set.

## Issues And Risks

### Critical Correctness Issues

1. `discardExpiredByProduct` appears to be wrong.

In [src/data/packsRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/packsRepo.ts), `discardExpiredByProduct` updates expired packs with `{ active: true }`. The intended behavior is almost certainly to set them inactive or otherwise mark them discarded. It also does not create `DISCARD` stock events. This means the UI action "Discard expired packs" may not actually discard anything.

Recommended fix:

- Set `active: false`.
- Insert one `DISCARD` stock event per affected pack with `deltaUnits` equal to `-unitsRemaining`.
- Set `unitsRemaining` to 0, or define clearly whether inactive packs retain historical remaining units.
- Include before/after metadata.
- Add tests.

2. Multi-table mutations are not transactional.

Examples:

- Add pack inserts a pack, then inserts stock event, then assigns dots.
- Consume updates pack units, inserts event, starts session, decrements holiday allocation.
- Import deletes and reinserts many tables.
- Holiday creation inserts holiday and multiple pack-list rows.

If the app crashes halfway through one of these flows, the database can become inconsistent.

Recommended fix:

- Wrap all multi-step writes in SQLite transactions.
- Start with consume, add pack, undo, import, holiday creation, and holiday allocation.

3. Undo deletes history instead of preserving an audit trail.

[src/data/historyRepo.ts](/Users/jonat/Projekte/diabetes-supply-app/src/data/historyRepo.ts) deletes the last `TAKE` event and deletes the related session. The schema already supports an `UNDO` event type and `relatedEventId`, but the implementation does not use it.

Recommended fix:

- Keep the original `TAKE`.
- Insert an `UNDO` event with `deltaUnits: +1`, `relatedEventId`, and metadata.
- Restore pack units.
- Mark or link the session as undone instead of deleting it, or insert compensating session metadata.
- Update history UI to render undo relationships.

4. Consumption can race or over-consume.

`consumeOneUnit` reads a pack and then updates it with `unitsRemaining - 1`. There is no conditional update like `WHERE unitsRemaining > 0`. On a single-user mobile app this is less likely, but double taps, retries, or concurrent mutation calls can still create bad state.

Recommended fix:

- Disable buttons while mutation is pending.
- Use an atomic conditional update or transaction.
- Add a final invariant check after the update.

5. Holiday allocation can produce duplicate allocation rows for the same holiday and pack.

`addPackToHoliday` always inserts a new row. This can be valid if representing multiple packing actions, but it complicates calculations and undo. The app often picks the first row with units.

Recommended fix:

- Decide whether `(holidayId, packId)` should be unique.
- If unique, merge units into an existing allocation and keep `originalUnits` accurate.
- If duplicates are allowed, update all code to treat rows as a deliberate append-only allocation log.

### High Priority Data Model Issues

1. Foreign keys have no explicit cascade behavior.

If future delete/archive features are added, orphan handling needs to be defined.

2. Several important uniqueness constraints are missing.

Recommended constraints:

- Product identifiers should probably be unique by `(type, value)`.
- Pack raw code may need uniqueness per product or per identifier depending on barcode semantics.
- Colored-dot assignment should likely be unique by `packId`.
- Active session should be unique per product, though SQLite partial unique indexes may be needed.

3. `active` is inconsistently typed and interpreted.

Some code checks booleans, some guards against numbers, and one bug sets expired packs active. Normalize boolean handling and define clear semantics for inactive products and inactive packs.

4. Stock event semantics need stronger definitions.

The app should define:

- Whether `deltaUnits` is required for all event types.
- Whether `occurredAt` can differ from `createdAt`.
- Whether manual adjustments are allowed to edit historical events or only create compensating records.
- How holiday consumption is represented in event metadata.

5. Warning records are modeled but not functionally connected.

`app_warnings_for_products` exists but notifications appear to be settings-only. There is no complete warning generation or native notification scheduling flow visible in the app.

### Barcode And Parser Risks

1. GS1 parsing for variable-length fields is heuristic.

Without FNC1 separators, detecting boundaries for variable-length AIs can be ambiguous. The current parser uses lookahead and seen-AI logic. This is useful, but medical product barcodes can be strict and safety-sensitive.

Recommended improvements:

- Add test vectors from real scanned labels.
- Store parser confidence and raw code.
- Show parsed fields for confirmation before creating a pack.
- Consider a stricter mode when a serial/lot/expiry boundary is uncertain.

2. GS1 date handling needs more edge-case support.

GS1 expiry date day `00` can be used in some contexts to mean the last day of the month. The current `isValidGS1Date` rejects day `00`.

3. EAN13 and GTIN matching should normalize consistently.

GTINs may appear as 14 digits, while EAN13 can correspond to leading-zero GTINs. Define canonical normalization rules so the same product is not duplicated.

4. Scan flow only uses the first detected barcode.

If a picture contains multiple codes, the app may choose the wrong one.

Recommended improvement:

- Present candidates when multiple barcodes are detected.
- Prefer GS1 medical data over unrelated retail barcodes.

### UI And Workflow Issues

1. There are many `alert()` calls.

Alerts are fast to implement but make flows feel abrupt and are harder to style, localize, test, and recover from.

Recommended improvement:

- Replace with Paper `Dialog` or `Snackbar` patterns.
- Preserve user context and offer specific recovery actions.

2. The app exposes internal IDs.

The product page displays `ID: {product.id}` prominently. This is useful for debugging but not meaningful for a normal private user.

Recommended improvement:

- Hide IDs behind a developer/debug section or copyable details panel.

3. Product settings cannot edit many product attributes.

After creation, the user cannot easily change:

- Units per pack default.
- Expiry behavior.
- Session-based flag.
- Nominal session duration.
- Product active/inactive state.

4. No visible product archive/delete workflow.

Products have `active`, but the UI does not appear to provide a complete archive/reactivate workflow.

5. Empty states use a generic icon and copy.

Some empty states say "No products here yet" or "No holidays here yet". They should be more action-specific and safety-aware.

6. Holiday function setting hides the holiday tab but does not prevent deep-link access.

This may be acceptable, but if the feature is disabled the internal routes should either redirect or explain that Holiday Mode is disabled.

7. The product page is dense.

The page mixes inventory actions, pack table, holiday status, last item, stats, history, and session controls. It works for a power user but will become hard to use as features expand.

Recommended improvement:

- Split into tabs or sections: Overview, Packs, History, Statistics, Settings.
- Keep primary actions visible at top.

8. Naming is inconsistent.

Examples:

- `ConsumtionDialogInfo` typo.
- "Holiday" may be better as "Trip" for international/general use.
- "Use holiday function" is less natural than "Enable trip planning".

### Backup And Privacy Risks

1. Exported backup is plain JSON.

It may include medical supply names, product images, usage history, and travel plans. That is sensitive personal health-adjacent data.

Recommended improvements:

- Offer optional password encryption.
- Warn clearly that backups are unencrypted.
- Include checksum/version metadata.
- Consider compressed backup format.

2. Import is destructive and not transactional.

The UI warns the user, but the import operation itself should be atomic.

Recommended fix:

- Validate the whole file first.
- Restore into temporary tables or transaction.
- Only delete existing data after all validation passes.
- On failure, preserve current data.

3. Image lifecycle is incomplete.

Imports create new image files, but there is no cleanup for orphaned images when products change photo or imports repeat.

### Query And State Issues

1. Some invalidation keys are broad or inconsistent.

Examples:

- `useEndSession` invalidates `["session"]`, `["sessionStatistics"]`, and `["daysUntilOutOfStock"]` rather than consistently using parameterized keys.
- Some holiday-related changes invalidate `holidays` but not all derived calculations.

Recommended improvement:

- Centralize invalidation helpers by domain action.
- Use `qk` everywhere.

2. Some calculations import the global `db` instead of using injected DB.

[src/utils/calculateHolidayNeeds.ts](/Users/jonat/Projekte/diabetes-supply-app/src/utils/calculateHolidayNeeds.ts) imports global `db`. That makes testing harder and couples pure-ish calculation code to app runtime.

Recommended improvement:

- Pass repository instances or a DB parameter into calculation functions.

3. Scan context is volatile.

The add-pack flow depends on in-memory scan context. If the app reloads between scan and add-pack, the flow can break.

Recommended improvement:

- Persist draft scan results temporarily.
- Detect missing scan context and route the user back with a clear message.

### Native Module Risks

1. Android-native barcode processing is present; iOS support is unclear.

The repo has Android native modules. If iOS is intended, this needs explicit support or graceful feature gating.

2. Large image processing may have memory pressure.

The native module decodes full images and converts to RGB byte arrays. High-resolution camera captures may be memory-heavy.

Recommended improvements:

- Resize/compress before processing.
- Process camera frames directly if feasible.
- Add timeout/error UI.

### Testing And Maintainability Issues

1. There are no visible automated tests.

The most important business rules are currently unprotected:

- GS1 parsing.
- Add pack.
- Consume item.
- Undo.
- Discard expired.
- Session lifecycle.
- Days until out of stock.
- Holiday snapshotting.
- Cross-holiday reservation safety.
- Backup/import round trips.

2. Business logic is split between screens, hooks, repos, and utils.

Some important logic, such as choosing the next pack to consume, lives in the product screen. That should be moved into testable domain services.

3. Schema migrations are numerous and should be periodically checked against fresh installs.

There are many Drizzle migrations. A fresh database and an upgraded database should both be tested.

## Quality Of Life Improvements

### Daily Use

- Quick "take one" action from the home screen for common products.
- Configurable default consume strategy per product: earliest expiry, fewest units, opened pack first, manual choose.
- Confirm exact pack only when multiple plausible packs exist.
- "I used a different pack" option in consume dialog.
- Show "opened/current pack" for products where that matters.
- Add a low-stock dashboard sorted by days remaining.
- Add an expiring-soon dashboard sorted by expiry date.
- Add a "shopping / reorder list" generated from thresholds.
- Add a "recent activity" feed on the home screen.
- Add a global search that includes product names, identifiers, serials, lots, and notes.

### Pack Management

- Manual add pack without scanning.
- Bulk add multiple identical packs.
- Split a pack into home/travel portions.
- Merge duplicate pack records.
- Mark a pack as opened.
- Mark a pack as misplaced/found.
- Add storage location: drawer, fridge, bag, bathroom, travel kit.
- Add lot number display and filtering.
- Add notes per pack.
- Add photo per pack or package label.

### Safety And Reliability

- Confirm before consuming expired packs and default to blocking them.
- Warn when active stock is below configured safety buffer.
- Warn when all remaining stock expires before estimated run-out date.
- Add emergency reserve tracking that normal consumption should not draw from unless confirmed.
- Add "minimum stock" per product.
- Add "reorder at" per product.
- Add "lead time" per product, so reorder warnings account for delivery delays.
- Add "do not use after opened for X days" for products with post-opening limits.

### Sessions

- Show active session age and expected end date.
- Notify when a session is near nominal end.
- Allow session notes and failure reason details.
- Let users correct session start/end times.
- Track sensor/transmitter/site location if relevant.
- Show session success rate over time.
- Compare actual session duration to nominal.

### Scanning

- Continuous scanning mode instead of still-photo-only scanning.
- Multi-barcode candidate picker.
- Scan result review screen before saving.
- Manual correction of parsed expiry/lot/serial.
- Better scan-failure guidance with examples.
- Flash/zoom controls with clearer ergonomics.
- Store scan confidence and source.

### Holiday / Trip Mode

- Rename "holiday" to "trip" or make terminology configurable.
- Add trip start and end dates instead of only duration.
- Add destination notes and medical requirements.
- Add outbound/return travel buffer.
- Add separate "carry-on" and "checked luggage" lists.
- Add "daily bag" vs "backup bag" allocation.
- Add "packed physically" checklist independent of database allocation.
- Warn if packed items expire during the trip.
- Warn if items require refrigeration.
- Generate printable/shareable packing list.
- Add "return home" reconciliation: what came back, what was used, what was lost.
- Support multiple upcoming trips with overlapping reservations.

### Backup And Device Migration

- Scheduled backup reminders.
- Optional encrypted backup.
- Backup health check / restore preview.
- Export CSV for packs/history.
- Export PDF summary for travel or doctor visits.
- Import dry run showing what will be replaced.

### Accessibility And Localization

- Replace hard-coded German date locale with user/device locale or app setting.
- Add full localization strategy.
- Increase support for screen readers.
- Check touch targets.
- Improve contrast for warning chips and chart colors.
- Avoid relying only on color for colored-dot identification; add labels/patterns.

## Additional Feature Ideas

### Medical Inventory Generalization

The project can be generalized from diabetes supplies to "private medical stock at home" by changing domain labels and adding more flexible product attributes.

Potential target inventory types:

- Diabetes supplies.
- Prescription medications.
- Over-the-counter medicines.
- First-aid supplies.
- Medical devices and disposables.
- Pet medication.
- Caregiving supplies for children or elderly relatives.
- Emergency preparedness medical kits.

Generalized concepts:

- Product becomes "item".
- Pack becomes "container", "package", or still "pack".
- Units can be pills, strips, sensors, needles, milliliters, vials, patches, cartridges, bags, or pieces.
- Session-based use becomes "use cycle".
- Holiday Mode becomes "Trip Mode".
- Colored dots become "physical labels".

Suggested schema extensions:

- `unitName`: piece, strip, sensor, pill, ml, vial, cartridge.
- `unitPluralName`.
- `categoryId`.
- `storageLocationId`.
- `requiresRefrigeration`.
- `controlledSubstance` or `sensitiveItem`, if appropriate.
- `prescriptionRequired`.
- `prescriber`.
- `pharmacy`.
- `reorderUrl` / `supplier`.
- `leadTimeDays`.
- `minimumStockUnits`.
- `targetStockUnits`.
- `openedAt`.
- `discardAfterOpeningDays`.
- `doseInstructions` or private notes.
- `careRecipientId` for households managing supplies for multiple people.

### Household / Multi-Person Support

For a private home, one app may need to manage supplies for multiple people.

Add:

- People/profiles.
- Product ownership: one person, multiple people, or shared household.
- Per-person usage statistics.
- Per-person trip packing.
- Caregiver mode.
- Emergency contact/export summary.

### Notifications

Complete the notification system:

- Running out soon.
- Expiry approaching.
- Expired items present.
- Reorder reminder.
- Active session nearing expected end.
- Trip packing deadline.
- Backup reminder.

Implementation notes:

- Use Expo Notifications.
- Store generated warning state separately from notification preferences.
- Avoid noisy repeated notifications by recording last-notified timestamps.
- Give every notification a deep link into the relevant product/pack/trip.

### Reporting

Add reports:

- Monthly consumption by product.
- Waste due to expiry/discard.
- Session outcome trends.
- Reorder forecast.
- Trip consumption summary.
- Inventory valuation if users enter cost.

### Integrations

Possible future integrations:

- Calendar reminders.
- Cloud backup provider chosen by user.
- Supplier reorder links.
- PDF export for doctors/travel.
- Apple Health / Google Health only if there is a clear user benefit and privacy story.

## Refactoring Plan

### Phase 1: Correctness Foundation

1. Fix expired discard behavior.
2. Add transactions around multi-table writes.
3. Implement audit-preserving undo.
4. Add uniqueness constraints where safe.
5. Add tests for stock mutations.
6. Normalize query invalidation keys.

### Implementation Status

Updated: 2026-07-07

- Done: Fixed expired-pack discard behavior in `packsRepo.discardExpiredByProduct`. Expired active packs are now deactivated, their remaining units are zeroed, and `DISCARD` stock events are written with before/after metadata.
- Done: Added transactions around core multi-table inventory writes: adding packs, consuming one unit, discarding expired packs, and undoing a take action.
- Done: Reworked undo to preserve audit history. Undo now inserts an `UNDO` stock event linked to the original `TAKE`, restores pack units, restores active-holiday allocation where relevant, and marks related sessions as undone rather than deleting rows.
- Done: Updated usage/session statistics and last-consumed views to ignore undone takes/sessions while keeping the audit trail visible in history.
- Done: Added safe duplicate prevention at the repository layer for product identifiers and colored-dot assignments. Product identifiers now guard uniqueness by `(type, value)`, and colored-dot assignment writes collapse duplicate rows for a pack.
- Done: Made product creation from a scanned identifier transactional so product and identifier creation cannot split.
- Verified: Focused ESLint passed for the changed data and product-history files. `git diff --check` passed.
- Known verification gap: full `npm run lint` still reports pre-existing unrelated lint errors in other app screens. `npx tsc --noEmit` is blocked by missing native-module type resolution for `expo-modules-core`.
- Done: Normalized query invalidation keys in mutation hooks by adding `src/data/invalidation.ts` domain helpers and root query keys in `src/data/queryKeys.ts`. Inventory, usage-statistics, session, identity, and holiday-reservation invalidations now reuse shared helpers instead of raw query-key arrays or predicates.
- Verified: Focused ESLint passed for the invalidation helper, updated query keys, and changed mutation/query hooks. `git diff --check` passed after the invalidation cleanup.
- Done: Started Phase 2 domain-service extraction by adding `src/domain/inventoryService.ts`. The product screen now delegates consume-pack selection rules to a pure `choosePackForConsumption` service while keeping data fetching and UI rendering in the screen.
- Verified: Focused ESLint passed for the new inventory service and the refactored product screen. `git diff --check` passed after the service extraction.
- Done: Added transactions around holiday creation and holiday pack allocation. Repeated allocation of the same pack to the same holiday now merges into the existing row instead of creating duplicate allocation rows.
- Verified: Focused ESLint passed for `src/data/holidayRepo.ts`. `git diff --check` passed after the holiday transaction/allocation change.
- Done: Fixed GS1 parser date validation to accept day `00`, allowing expiry dates such as `YYMM00` to flow into the existing expiry normalizer where they become the last day of the month.
- Verified: Focused ESLint passed for `scripts/gs1.ts` and `src/utils/dateUtils.ts`. `git diff --check` passed after the parser fix.
- Done: Added editable product defaults to the product settings screen: default units per pack, active/archive status, expiry behavior, session-based behavior, nominal session length, photo, name, and colored-dot use. Photo capture and colored-dot scan return flows now preserve these unsaved settings parameters.
- Verified: Focused ESLint passed for the changed product-settings, photo-return, product repo, and update-hook files with only pre-existing unused-variable warnings. `git diff --check` passed after the product settings update.
- Done: Removed the prominent internal product ID from the product detail header so normal users see meaningful inventory information rather than database identifiers.
- Verified: Focused ESLint passed for the product detail screen. `git diff --check` passed after the ID display cleanup.
- Done: Made backup import safer by validating required/optional arrays before destructive writes, restoring all database rows inside one transaction, and cleaning up newly restored image files if the database restore fails. Export now writes version 3 backups including holidays, holiday pack lists, holiday pack allocations, and warning records while import remains backward-compatible with v1/v2 backups.
- Verified: Focused ESLint passed for import/export hooks. `git diff --check` passed after the backup import/export safety change.
- Done: Hardened `consumeOneUnit` against over-consumption by making the pack decrement conditional on `unitsRemaining > 0` and failing the transaction if no row is updated.
- Verified: Focused ESLint passed for `src/data/packsRepo.ts`. `git diff --check` passed after the consume race guard.
- Done: Wrapped manual pack edits and their `ADJUST` stock events in a transaction so partial manual adjustments cannot leave pack state and audit history out of sync.
- Verified: Focused ESLint passed for `src/data/packsRepo.ts`. `git diff --check` passed after the manual adjustment transaction change.
- Done: Cleaned the remaining project lint baseline issues, including unescaped UI text, the conditional Drizzle Studio hook in the root layout, stale hook dependencies, and unused variables in affected screens.
- Verified: Full `npm run lint` now passes with no warnings or errors. `git diff --check` passed after the lint cleanup.
- Done: Fixed the remaining TypeScript blocker by making `expo-modules-core` an explicit dependency for the local native module import and tightening the database null check in product creation with identifier.
- Verified: Full `npx tsc --noEmit` now passes. Full `npm run lint` still passes.
- Done: Completed the basic archive/reactivate workflow path by making the home inventory hide archived products by default, adding a Show archived products toggle, and labeling archived product cards when visible.
- Verified: Focused ESLint passed for the home screen and product card. Full `npx tsc --noEmit` passed. `git diff --check` passed after the archive filter change.
- Done: Added manual pack creation by reusing the existing add-pack screen in manual mode. Product detail now has an Add pack action, and manual entries can create packs without scan context while preserving optional expiry, units, colored dots, and audit notes.
- Verified: Focused ESLint passed for manual add-pack files. Full `npx tsc --noEmit` passed. `git diff --check` passed after the manual add-pack change.
- Done: Added an export confirmation dialog that warns backups are unencrypted plain JSON and may contain personal inventory data, product images, history, settings, and trip plans.
- Verified: Focused ESLint passed for the settings screen. Full `npm run lint` and full `npx tsc --noEmit` passed after the export warning change.
- Done: Added an npm `typecheck` script so TypeScript verification can be run consistently with `npm run typecheck`.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after adding the script.
- Done: Added `src/domain/scanService.ts` for barcode identifier normalization and lookup aliases. GTIN/EAN13 scans now strip formatting characters and match compatible leading-zero variants, so a GS1 GTIN such as a 14-digit leading-zero code can resolve an existing EAN13 product identifier and vice versa.
- Done: Updated scan lookup, scanned-product creation checks, and identifier creation conflict checks to use normalized matching while preserving the existing configurable product and identifier model.
- Verified: Full `npm run lint` and `npm run typecheck` passed after the identifier normalization change.
- Done: Moved scan product-identifier extraction into `scanService` and updated the camera scan flow to inspect all detected barcodes, selecting the first barcode that yields a valid GS1/EAN product identifier instead of relying only on the first detected barcode.
- Verified: Full `npm run lint` and `npm run typecheck` passed after the scan extraction and multi-barcode selection change.
- Done: Replaced raw scan failure alerts on the scan screen with a React Native Paper snackbar for consistent, dismissible error feedback.
- Verified: Full `npm run lint` and `npm run typecheck` passed after the scan snackbar cleanup.
- Done: Added trip dates and return-home reconciliation fields to holidays, including migration `0044_trip_dates_reconciliation.sql`.
- Done: Made planned trips editable from the trip list. The planner now supports create/edit mode, optional start/return dates, automatic duration calculation from dates, active-product filtering, and transactional planned-trip updates that recalculate snapshot amounts.
- Done: Added a return-home reconciliation action for completed trips so the user can mark the post-trip check as complete.
- Verified: Full `npm run lint` and `npm run typecheck` passed after the trip dates, planned-trip editing, and return-home reconciliation slice.
- Done: Started `holidayPlanningService` with trip expiry warning generation. Planned trips warn about recommended packs that expire before/during the trip, while packed/active trips warn about the concrete packed allocations.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the trip expiry warning slice.
- Done: Added backup import preview. Import now picks and validates the backup first, shows version/export time and row counts, and only performs the destructive restore after a final confirmation against that selected file.
- Verified: Full `npm run lint` and `npm run typecheck` passed after the import preview slice.
- Done: Added Expo notification scheduling support with `expo-notifications`. Inventory warnings are generated from current stock: expiry-approaching warnings for active expiring packs and run-out-soon warnings from usage statistics. The app refreshes schedules on startup and Settings includes a manual refresh action.
- Done: Started `statisticsService` by extracting days-until-out-of-stock estimation into `src/domain/statisticsService.ts` for reuse by hooks and notification generation.
- Verified: Full `npm run lint` and `npm run typecheck` passed after the notification scheduling and warning generation slice.
- Done: Replaced remaining raw `alert()` calls with React Native Paper snackbars or dialogs across add-pack, new-product, choose-existing-product, product consumption, and colored-dot scanning flows.
- Verified: `rg` found no remaining `alert()` or `Alert.alert` usages under app/source folders. Full `npm run lint` and `npm run typecheck` passed after the alert cleanup.
- Done: Fixed the Android Metro bundling failure by adding `babel-preset-expo` as an explicit SDK 54-compatible dev dependency, matching the preset referenced by `babel.config.js`.
- Verified: `require('babel-preset-expo/package.json').version` resolves to `54.0.11`; full `npm run lint` and `npm run typecheck` passed after the bundler dependency fix.
- Done: Added optional Google Drive backup/restore foundation. Settings now accepts a configurable Google Drive access token, can upload the current unencrypted JSON backup to Drive, can list the latest app-created Drive backup, and can restore the latest backup through the same validated transactional import path as local imports.
- Done: Extended Google Drive backup settings with an optional Drive folder ID, manual/daily/weekly/monthly backup frequency, retention count, old-backup pruning, and app-start automatic backup when the configured interval is due.
- Done: Extracted backup JSON generation from the local export hook so local export and Google Drive upload share the same versioned backup format.
- Done: Replaced the unsupported `bell-sync` icon with the supported `bell` icon for refreshing notification schedules.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the Google Drive backup/restore slice.
- Done: Cleaned up the product detail page by keeping the product summary/actions visible and splitting secondary detail into Overview, Packs, Insights, and History tabs.
- Verified: `npm run typecheck` passed after the product detail cleanup.
- Done: Added full configurable Google Drive OAuth support using AuthSession PKCE authorization-code flow, offline access, locally stored refresh tokens, manual refresh/disconnect controls, and automatic token refresh for Drive list/upload/restore/startup backup operations.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the Google Drive OAuth refresh-token slice.
- Done: Added notification deep-link handling. Scheduled inventory notifications now include product route metadata and tapping one opens the related product screen, including cold-start notification responses.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the notification deep-link slice.
- Done: Added holiday deletion. Holidays can now be deleted from the trip list with confirmation, and deletion transactionally removes packed allocations, product needs, and the holiday row.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the holiday deletion slice.
- Done: Reverted the product detail page tab cleanup after user feedback; the screen now renders the original continuous detail layout again.
- Done: Improved scan review/recovery. The scan screen now surfaces multiple detected product identifiers for user selection, shows raw detected codes when none can be interpreted as product identifiers, and lets raw codes flow into manual entry.
- Done: Continued service extraction by moving scan destination resolution into `scanService`, product consume-dialog pack assembly into `productConsumptionService`, and colored-dot combination selection into `coloredDotCombinationService`.
- Done: Reworked generated colored-dot combinations to avoid one-query-per-pack lookup and full combination materialization. Existing product combinations are fetched in one joined query, and unused combinations are sampled directly while staying random and unique per product.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the scan recovery, service extraction, colored-dot generation, and product detail revert slice.
- Follow-up: Google Drive OAuth works, but it is too configuration-heavy for a local unsigned APK. A better release direction is to make local export/share and import the primary backup path, then optionally add a simpler user-owned file target later instead of presenting OAuth as the normal setup.
- Done: Hid the untested Google Drive backup integration behind an Advanced Google Drive Backup toggle. Drive auto-backup now also respects that toggle before doing any OAuth/token work.
- Done: Added automatic local backups using the same JSON backup format as export/Drive. Settings now supports manual/daily/weekly/monthly local backup frequency, retention count, create/check/share latest/restore latest controls, and app-start automatic backup when due.
- Done: Corrected colored-dot generation to always prefer the shortest available per-product code first. It randomizes among unused combinations at the current shortest length and only grows to longer color codes after shorter combinations are exhausted.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the local backup, Drive toggle, and colored-dot shortest-code fix.
- Done: Fixed colored-dot generation for repeated physical stickers. Codes are now shortest unique multisets, so a product with only one available color can use one black dot, then two black dots, then three black dots, etc.
- Done: Added selectable local backup locations. Automatic/manual local backup listing, writing, pruning, sharing, restoring, and app-start backup now use the chosen directory URI, with a reset action to return to app-private storage.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the repeated-dot and backup-location fixes.
- Done: Fixed local backup file creation in user-selected directories by using the directory file-creation API and retrying with suffixed backup filenames if a same-name entry already exists.
- Verified: Full `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the local backup creation fix.

### Phase 2: Domain Services

Move business logic out of screens into testable services:

- `inventoryService`: add pack, consume, adjust, discard, undo.
- `holidayPlanningService`: calculate needs, reserve packs, activate/end trip. Trip expiry warning generation has started in `src/domain/holidayPlanningService.ts`; more calculation and reservation logic still needs to move out of screens/utils.
- `scanService`: normalize identifiers and parser results. Identifier normalization and product-identifier extraction are now started in `src/domain/scanService.ts`; full scan review and recovery UX can continue later.
- `statisticsService`: estimate usage and run-out dates. Days-until-out-of-stock estimation has started in `src/domain/statisticsService.ts`; more statistics logic can still move out of hooks/repos later.

Keep repositories focused on persistence. Keep screens focused on rendering and user interaction.

### Phase 3: UX Cleanup

1. Replace alerts with consistent dialogs/snackbars. Implemented across current app/source screens.
2. Split product page into clearer sections.
3. Add manual pack creation.
4. Add editable product defaults.
5. Add locations and thresholds.
6. Improve scan review and recovery flows.

### Phase 4: Generalization

1. Rename user-facing diabetes-specific terms where needed.
2. Add item categories and unit labels.
3. Add storage locations.
4. Add care recipients / household profiles if desired.
5. Rename Holiday Mode to Trip Mode.

### Phase 5: Safety, Privacy, And Release Readiness

1. Complete notifications. Local inventory notification generation and scheduling are implemented; real-device permission/channel QA is still needed.
2. Add encrypted backups.
3. Add import transaction and restore preview. Transactional restore and preview-before-import are implemented.
4. Add accessibility pass.
5. Add fresh-install and migration tests.
6. Document limitations and non-medical-device disclaimer if distributing.

## Suggested Test Plan

### Unit Tests

Add tests for:

- GS1 parser with real and synthetic examples.
- GTIN/EAN normalization. Basic lookup and duplicate-prevention normalization is implemented; dedicated unit tests are still needed.
- Expiry date normalization.
- Average usage calculations.
- Days until out of stock.
- Holiday amount methods.
- Colored-dot combination generation.

### Repository / Database Tests

Use a test SQLite database and test:

- Add pack creates pack and `ADD` event.
- Consume decrements units and creates `TAKE`.
- Session product consume starts a session.
- Ending session updates outcome.
- Undo creates an audit entry and restores stock.
- Discard expired deactivates or zeroes correct packs and creates events.
- Holiday reservation prevents double booking.
- Import/export round trip preserves data.

### UI / Flow Tests

Add Expo/React Native Testing Library or E2E coverage for:

- Product creation from scan.
- Add pack with manual expiry.
- Consume and undo.
- Plan trip, pack trip, activate trip, consume trip items.
- Settings export/import dialogs.

### Manual QA Checklist

Before release, test:

- Fresh install.
- Upgrade from an older database.
- Android real device camera scan.
- No camera permission.
- Scan failure.
- Multiple products with same-looking packages.
- Expired pack handling.
- App restart in the middle of add-pack flow.
- Backup export and import on a second device.

## Prioritized Backlog

### P0

- Fix `discardExpiredByProduct`.
- Add transactions for add pack, consume, undo, import, and holiday create/allocate.
- Replace destructive undo with audit-preserving undo.
- Add tests for the above.

### P1

- Complete notification scheduling and warning generation. Local scheduling for expiry and run-out warnings is implemented.
- Add manual pack creation.
- Add editable product defaults.
- Normalize barcode identifiers. Basic GTIN/EAN13 matching, duplicate-prevention normalization, shared identifier extraction, first-valid multi-barcode selection, and snackbar-based scan errors are implemented; richer scan review remains follow-up work.
- Improve scan review and multi-barcode handling.
- Add import transaction/rollback safety.
- Add encrypted backup option or at least explicit unencrypted warning.

### P2

- Add storage locations.
- Add min/target stock and reorder lead time.
- Add expiring-soon and low-stock dashboards.
- Add trip dates, expiry-during-trip warnings, and return-home reconciliation. Trip dates, planned-trip editing, return-home reconciliation, and expiry-during-trip warnings are implemented.
- Add household/care-recipient model.

### P3

- Generalize naming and data model for non-diabetes medical inventory.
- Add reporting exports.
- Add cloud backup/sync only after privacy and conflict handling are designed. Initial configurable Google Drive upload/latest-restore foundation is implemented without encryption; full OAuth and conflict-aware sync remain follow-up work.

## Recommended Next Implementation Steps

1. Write a small test harness for repository functions using a temporary SQLite database.
2. Fix expired discard and cover it with tests.
3. Implement transaction helper and apply it to critical writes.
4. Rework undo to insert `UNDO` events.
5. Add product identifier uniqueness and normalization. Repository-level duplicate prevention and GTIN/EAN13 alias matching are implemented; tests should still be added.
6. Move holiday and inventory business rules into services.
7. Add manual add-pack flow, because it reduces dependence on perfect barcode scanning.

## Closing Assessment

The project already has a solid product idea and a data model that matches the real-world problem better than a simple stock counter would. The next leap is to make the core inventory rules reliable, auditable, and testable. Once that foundation is tightened, the app can grow naturally from a diabetes supply tracker into a broader private medical stock manager for home, travel, caregiving, and emergency preparedness.
