# Clinical Operations Board Redesign

## Goal
Refresh the interim demo page so it looks less like a generic boxed dashboard and more like a believable pharmaceutical cold-chain tracking interface while preserving the current working stakeholder flow.

## Current Context
- The browser demo is a single-page React view in `frontend/src/App.jsx`.
- The current layout is functional, but visually card-heavy and flat.
- The page already supports:
  - local Hardhat RPC connection
  - local stakeholder account display
  - role-granting and flow actions
  - batch summary
  - custody / conditions / verification timeline
  - address copy and show/hide address helpers

## Approved Direction
Use a **clinical operations board** style.

### Visual style
- Light clinical background
- Cool white surfaces
- Teal / cyan accents
- Softer, more intentional visual hierarchy
- Cleaner spacing and fewer heavy “boxes inside boxes”

### Layout direction
- Keep the page as a single demo page
- Re-layout the same content rather than changing the workflow itself
- Use a **balanced split**:
  - controls remain easy to click during the demo
  - results remain prominent enough to feel like a real tracking interface

## UX Changes

### Header
- Convert the current hero into a cleaner control header with:
  - project title
  - short status text
  - one concise explanation of what the page does

### Left-side operational area
- Group together:
  - local setup inputs
  - stakeholder account list
  - stakeholder action buttons
- Make this area feel like an operational console rather than stacked cards

### Right-side results area
- Keep batch summary and recent actions near the top
- Make the page feel more outcome-driven by surfacing the current state more clearly

### Provenance section
- Promote the provenance timeline into the strongest visual section
- Keep the three lanes:
  - custody
  - conditions
  - verification
- Reduce cramped presentation and improve scanability

### Account presentation
- Keep Accounts 0–4 clearly labeled and visually important
- De-emphasize Accounts 5–19 so they do not distract from the stakeholder story
- Preserve copy-to-clipboard support

### Address display
- Preserve:
  - short address summary
  - full-address reveal
  - copy support
- Prevent layout overlap when long addresses are revealed

## Constraints
- Do not change the smart contract flow
- Do not introduce a separate login system in this redesign
- Do not add new backend dependencies
- Keep the page safe for the interim demo recording
- Preserve the current button actions and data flow

## Files In Scope
- `frontend/src/App.jsx`
- `frontend/src/styles.css`

## Success Criteria
- The page still supports the current demo workflow without changing behavior
- The interface looks more polished and domain-appropriate for a pharma provenance demo
- Stakeholder actions and provenance output are both easy to explain on video
- Extra Hardhat accounts no longer visually dominate the page
- Address reveal blocks never overlap other content
