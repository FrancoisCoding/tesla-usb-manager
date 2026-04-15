# Marketplace USB Refresh (Apr 2026)

## Scope

- Replaced Tesla branding icons with USB-focused app icons (web + Tauri bundle assets).
- Enforced Step 1 -> Step 2 setup flow for Marketplace usage.
- Simplified Marketplace tabs so users view `Music` or `Light Shows`, never both.
- Converted USB path controls in Step 2 into read-only displays sourced from Step 1.
- Added mount-path badge styling for a cleaner, modern UI presentation.

## Technical Notes

- Added selected USB mount path persistence helpers in `src/usb/selection.ts`.
- Introduced Marketplace support helpers and tests:
  - `marketplaceViewFilter`
  - `marketplaceFilters`
  - `marketplaceSongInstall`
  - `marketplaceCustomInstall`
  - `marketplaceUsbPath`
- Added USB setup status helpers and tests in `usbSetupStatus`.

## Validation

- Unit tests pass via `npm test` (Vitest).
