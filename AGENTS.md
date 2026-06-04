# FIIP Water Operations DST Prototype Guide

## Project Intent

Build a simple, credible SPA prototype for the FIIP Water Operations Decision Support Tool described in the RFQ. The prototype should help FIIP operators reason about water diversion, conveyance, storage, and delivery decisions by timing, location, and amount.

## RFQ Anchors

- Owner context: CSKT Division of Engineering and Water Resources is the contracting owner; FIIP will own and use the tool.
- Core users: FIIP operators, BIA personnel, CSKT DEWR, CITT reviewers, and water-management technical staff.
- Operational areas: Mission South, Mission North, Jocko, and Little Bitterroot.
- Decision criteria: Minimum Enforceable Flows, Target Instream Flows, minimum reservoir pools, River Diversion Allowances, conveyance losses, conveyance limits, acreage served, and secondary diversion decisions.
- Data themes: SNOTEL SWE, runoff forecasts, streamflow, reservoir levels/storage, FIIP diversion flows, AgriMet/weather/ET, canal constraints, Compact criteria, and operator observations.
- Final-product geography: Mission South, Mission North, Jocko, and Little Bitterroot should read as operating areas in the interface rather than procurement phases.

## Development Principles

- Keep the app operational and scan-friendly. This is a working decision-support prototype, not a marketing landing page.
- Use React, Vite, TypeScript, and Bootstrap. Keep components small enough to understand quickly.
- Use the previous FIRO/DTS theme as the visual basis: restrained blue primary color, light neutral body background, quiet cards, dense tables, and readable operational controls.
- Prefer realistic mock data with clear labels over empty placeholders. Mock values should represent supply, demand, reservoir storage, compliance, and decision confidence.
- Make the first viewport useful: current basin status, supply-demand balance, key compliance constraints, and recommended action should be visible immediately.
- Use supplied Flathead/Mission imagery as environmental context, but keep the primary experience an operations dashboard.
- Avoid adding heavyweight GIS or charting dependencies for the prototype unless the workflow clearly needs them. A schematic map and simple SVG/CSS visualizations are acceptable.

## UX Expectations

- Provide controls operators would expect: basin selector, water-year type, forecast date, demand adjustment, conveyance-loss adjustment, and scenario compare.
- Make status legible by severity: ok, watch, warning, and critical.
- Show traceability: each recommendation should reference the criteria or data source theme that influenced it.
- Keep procurement and RFQ delivery language out of the main operator experience unless the user explicitly asks for proposal material.
- Keep accessibility in mind: semantic headings, form labels, visible focus, sufficient contrast, and no text overlap on narrow screens.

## Verification

- Run `npm run build` before delivery.
- Start the dev server and inspect the app in the browser after significant frontend changes.
- Check desktop and mobile widths for overflow, clipped controls, and unreadable charts.
