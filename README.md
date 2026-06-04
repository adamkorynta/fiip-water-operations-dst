# FIIP Water Operations DST Prototype

A single-page React application prototype for FIIP (Flathead Indian Irrigation Project) operations planning. The interface helps operators evaluate irrigation supply and delivery decisions by operating area, timing, and constraints such as streamflow criteria, reservoir minimum pools, conveyance losses, and diversion allowances.

## What This Prototype Does

- Presents four FIIP operating areas as selectable workspaces:
  - Mission South
  - Mission North
  - Jocko
  - Little Bitterroot
- Computes a scenario balance from:
  - Forecast supply
  - Demand adjustment
  - Conveyance loss adjustment
  - Water-year type (dry, normal, wet)
- Surfaces decision status levels:
  - ok
  - watch
  - warning
  - critical
- Produces operational recommendations tied to scenario status.
- Displays compact criteria checks (MEF/TIF) per flow point.
- Shows reservoir storage vs minimum-pool thresholds.
- Renders an operations map with basin-specific markers and status labels.
- Includes an action queue and operator review notes for traceability.
- Includes a mock model-run panel with scenario comparison.

## Technical Stack

- React 19
- TypeScript
- Vite 5
- Bootstrap 5
- Leaflet + React Leaflet
- Lucide React icons

## Project Structure

- src/main.tsx: App bootstrap and stylesheet imports.
- src/App.tsx: Main application UI and scenario logic.
- src/data.ts: Typed mock data models and basin datasets.
- src/styles/theme.css: Visual theme, layout, component styling, and responsive rules.
- public/images: Basin hero images used in the dashboard header.
- vite.config.ts: Vite build/server configuration, GitHub Pages base path, host allowlist.
- .github/workflows/deploy-pages.yml: GitHub Actions workflow for Pages build and deploy.

## Scenario Logic Summary

The scenario calculation in src/App.tsx derives:

- adjustedSupply from basin forecast and water-year factor.
- adjustedDemand from base demand and user demand adjustment.
- conveyanceLoss from adjusted demand and basin loss percentage plus user delta.
- deliveryNeed = adjustedDemand + conveyanceLoss.
- margin = adjustedSupply - deliveryNeed.
- rdaUse and rdaRemaining as seasonal allowance indicators.
- flowDeficits where current streamflow is below MEF.
- reservoirDeficits where storage approaches minimum-pool buffer.
- overall status from margin, flow deficits, and reservoir deficits using severity ranking.

This is prototype-level logic intended to demonstrate workflow and UI behavior, not final operational policy logic.

## Local Development

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

## Install

```bash
npm ci
```

## Start Development Server

```bash
npm run dev
```

Current dev script runs Vite on host 0.0.0.0 and port 5199.

## Build

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

## Available Scripts

From package.json:

- dev: vite --host 0.0.0.0 --port 5199
- build: tsc -b && vite build
- preview: vite preview --host 127.0.0.1

## Deployment to GitHub Pages

This repository is configured for Pages under the repository path:

- /fiip-water-operations-dst/

The Vite base path is already set accordingly in vite.config.ts.

## Automated Deployment

A GitHub Actions workflow is included at:

- .github/workflows/deploy-pages.yml

It:

1. Runs on push to main (and manual dispatch).
2. Installs dependencies with npm ci.
3. Builds the project.
4. Uploads dist as a Pages artifact.
5. Deploys using actions/deploy-pages.

## GitHub Setup Steps

1. Push the repository to GitHub.
2. In repository settings, open Pages.
3. Set Source to GitHub Actions.
4. Push to main to trigger deployment.
5. Access the site at:
   - https://<your-username>.github.io/fiip-water-operations-dst/

## Hostname and Network Access Notes

Development host allowance is configured to accept Host headers for:

- localhost
- tacocat

In addition to script host binding, this helps support local access patterns while keeping host checks explicit.

## Data and Prototype Scope

- Data in src/data.ts is mock/prototype data informed by RFQ themes.
- Some map points are marked prototype approximate.
- Recommendations and statuses are deterministic prototype outputs for demonstration.
- The prototype is intended for workflow and UX validation, not production water allocation decisions.

## Accessibility and UX

Implemented patterns include:

- Semantic sectioning and labels for controls.
- Visible focus outlines via :focus-visible styling.
- Severity-based status chips and action cards.
- Responsive behavior for tablet/mobile breakpoints.

## Verification Checklist

Before sharing or release:

1. Run npm run build.
2. Verify map, controls, and scenario outputs load as expected.
3. Check desktop and mobile widths for clipped UI or overlap.
4. Confirm Pages workflow passes after pushing to main.

## RFQ Context File

- rfq_extracted.txt is included as reference context for prototype alignment.

## License

No license file is currently included. Add a LICENSE file if you intend to open-source or define usage terms.
