# FRA-36 QA Matrix: Audio Marketplace Reliability

Date: 2026-04-13
Issue: [FRA-36](/FRA/issues/FRA-36)
Parent: [FRA-13](/FRA/issues/FRA-13)

## Execution Context

- Automated tests executed in this workspace.
- Static source review for UI behavior not covered by unit tests.
- No live Tesla USB hardware available in this heartbeat.

## Evidence Snapshot

- `npm test` -> 4 test files passed, 20 tests passed.
- `cargo test` (`src-tauri`) -> 7 tests passed, 0 failed.

## Matrix

| ID | Coverage Area | Method | Result | Evidence |
| --- | --- | --- | --- | --- |
| QA-01 | Catalog parse + category extraction | Unit tests | Pass | `src/audio/marketplace.test.ts`; `src-tauri/src/marketplace.rs` tests |
| QA-02 | Catalog load failure state | Source review | Pass | `src/screens/Marketplace.tsx` sets `catalogErr` and renders failure card |
| QA-03 | Category filtering | Source review | Pass | `activeTab` filter logic in `src/screens/Marketplace.tsx` |
| QA-04 | Search filtering | Source review | **Fail** | No search input/state in `src/screens/Marketplace.tsx` |
| QA-05 | Preview playback | Source review | Pass | `togglePreview` uses `Audio`, toggles play/stop state in `src/screens/Marketplace.tsx` |
| QA-06 | One-click install destination correctness | Unit tests + source review | Pass | `src/audio/pipeline.test.ts`; `src/audio/pipeline.ts`; `src-tauri/src/lib.rs` target path mapping |
| QA-07 | Drag/drop supported format handling | Unit tests + source review | Pass | Allowed extensions validated in `src/audio/pipeline.ts` and `src-tauri/src/lib.rs` |
| QA-08 | Drag/drop unsupported format handling | Unit tests + source review | Pass | Unsupported extensions return explicit validation error text |
| QA-09 | Drag/drop install confirmation UX | Source review | **Fail** | No confirmation modal/explicit confirm gate before `handleUpload` writes pipeline output |
| QA-10 | Non-blocking UI during async work | Source review | Pass | `loading`, `installing`, `uploading` state gates in `src/screens/Marketplace.tsx` |

## Failures and Repro Notes

### 1) Missing Search Filter UI

- Repro:
1. Open Marketplace screen.
2. Inspect controls for a text search input.
3. Observe only category tabs and pagination; no query input exists.
- Expected: User can filter sounds in real-time by name/query.
- Actual: Query filtering path is absent from UI.

### 2) Missing Confirmation Before Custom Install Write

- Repro:
1. Drop a supported audio file in Marketplace.
2. Select target and click `Install Custom`.
3. Observe pipeline runs immediately with no confirmation modal/typed confirmation.
- Expected: Explicit confirmation step showing target drive/path before write.
- Actual: Write flow proceeds directly from button click.

## Regression Notes

- Destination mapping currently resolves to:
  - Lock chime: `LockChime/LockChime.wav`
  - Horn: `Boombox/Horn.wav`
- This is consistent across frontend and backend pipeline logic, with passing tests.
- Parent issue notes mention `Music/` for horn in older text; current implementation is aligned to boombox path usage.

## Defects Filed

- [FRA-130](/FRA/issues/FRA-130) - Marketplace search filtering missing from UI controls.
- [FRA-129](/FRA/issues/FRA-129) - Marketplace custom-audio install lacks confirmation gate.
