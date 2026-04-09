# Clinical Operations Board Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the interim browser demo into a cleaner clinical operations board while keeping the existing stakeholder workflow intact.

**Architecture:** Keep the React demo as a single page, but reorganize its markup into clearer presentation zones: header, operations panel, results panel, and a stronger provenance section. Use CSS tokens, softer surfaces, and clearer density control rather than adding new libraries or changing contract behavior.

**Tech Stack:** React 18, Vite, plain CSS, ethers v6

---

### Task 1: Reorganize the page structure in `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`
- Test: `frontend/package.json`

- [ ] **Step 1: Write the failing check**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS now, giving a baseline before restructuring.

- [ ] **Step 2: Replace the current two-card grid framing with named presentation zones**

Use markup shaped like:

```jsx
<main className="operations-board">
  <section className="board-top">
    <section className="panel panel-operations">{/* setup + accounts + actions */}</section>
    <section className="panel panel-results">{/* batch summary + recent actions */}</section>
  </section>

  <section className="panel panel-provenance">
    {/* custody / conditions / verification lanes */}
  </section>
</main>
```

- [ ] **Step 3: Keep the existing action handlers untouched while moving their rendered controls**

Preserve these handlers exactly:

```jsx
connectToLocalNode
grantRoles
registerBatch
moveToDistributor
completeDelivery
refreshBatchDetails
```

- [ ] **Step 4: Run the build after the JSX restructure**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "refactor: reorganize demo page structure"
```

### Task 2: Introduce the clinical operations board styling

**Files:**
- Modify: `frontend/src/styles.css`
- Test: `frontend/package.json`

- [ ] **Step 1: Add a restrained clinical design token layer**

Add or update root variables similar to:

```css
:root {
  --bg: #eef6f7;
  --surface: rgba(255, 255, 255, 0.88);
  --surface-strong: #ffffff;
  --ink: #12333d;
  --muted: #5e7881;
  --accent: #15808c;
  --accent-soft: #d8eef1;
  --border: rgba(21, 128, 140, 0.14);
  --shadow: 0 20px 45px rgba(15, 47, 57, 0.08);
}
```

- [ ] **Step 2: Replace the current generic card styling with board-style panels**

Implement styling shaped like:

```css
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
}
```

- [ ] **Step 3: Strengthen hierarchy for the top layout and provenance section**

Add structure like:

```css
.board-top {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 1rem;
}

.panel-provenance {
  margin-top: 1rem;
}
```

- [ ] **Step 4: Re-run the build to verify CSS-only changes did not break the app**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: apply clinical operations board theme"
```

### Task 3: Refine the stakeholder account presentation

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/package.json`

- [ ] **Step 1: Split primary and secondary accounts in render logic**

Use a derived model like:

```jsx
const primaryAccounts = accounts.slice(0, 5);
const extraAccounts = accounts.slice(5);
```

- [ ] **Step 2: Render the first five accounts as the explicit stakeholder group**

Use markup shaped like:

```jsx
<div className="stakeholder-group">
  {primaryAccounts.map((account, index) => (
    <div key={account} className="stakeholder-row">{/* label + short address + copy */}</div>
  ))}
</div>
```

- [ ] **Step 3: Render Accounts 5–19 inside a visually de-emphasized expandable section**

Use a native details block:

```jsx
<details className="extra-accounts">
  <summary>Show extra local test accounts</summary>
  {extraAccounts.map((account, offset) => (
    <div key={account} className="account-row">{/* account 5+ */}</div>
  ))}
</details>
```

- [ ] **Step 4: Add supporting styles**

Add styles such as:

```css
.stakeholder-row {
  background: var(--surface-strong);
  border: 1px solid var(--border);
  border-radius: 16px;
}

.extra-accounts {
  opacity: 0.9;
}
```

- [ ] **Step 5: Run build and commit**

Run:

```bash
cd frontend
npm.cmd run build
```

Then:

```bash
git add frontend/src/App.jsx frontend/src/styles.css
git commit -m "feat: focus stakeholder account display"
```

### Task 4: Make the provenance lanes easier to read during the demo

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/package.json`

- [ ] **Step 1: Keep the existing data, but restyle each lane as a cleaner activity track**

Keep rendering:

```jsx
custodyHistory
conditionHistory
verificationHistory
```

but move toward markup like:

```jsx
<div className="timeline-lane">
  <div className="timeline-entry">
    <strong>Manufacturer to Distributor</strong>
    <p className="actor-copy">0x7099...79C8 to 0x3C44...93BC</p>
  </div>
</div>
```

- [ ] **Step 2: Keep the show/hide full-address behavior and make it layout-safe**

Preserve the helper:

```jsx
renderAddressToggle(...)
```

and ensure its container sits within the lane width.

- [ ] **Step 3: Add lane styles that reduce overlap and improve scanning**

Use CSS shaped like:

```css
.timeline-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
}

.timeline-entry,
.address-details {
  min-width: 0;
}
```

- [ ] **Step 4: Run the build after the timeline pass**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/styles.css
git commit -m "style: improve provenance timeline readability"
```

### Task 5: Final verification for the interim demo

**Files:**
- Modify: `README.md` (only if the browser demo description needs wording updates)
- Test: `frontend/package.json`

- [ ] **Step 1: Run the frontend production build**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS

- [ ] **Step 2: Run the browser demo locally and verify the visible flow**

Use the existing setup:

```bash
# Terminal 1
npm.cmd run node

# Terminal 2
npm.cmd run deploy:local

# Terminal 3
cd frontend
npm.cmd run dev
```

Verify:
- stakeholder accounts 0–4 are prominent
- extra accounts are de-emphasized
- layout looks balanced
- address reveals do not overlap
- current demo buttons still work

- [ ] **Step 3: Update README only if wording now needs to mention the redesigned board layout**

If updated, keep the change minimal, for example:

```md
The browser demo uses a single local operations board layout for the interim presentation while still executing actions through different stakeholder accounts.
```

- [ ] **Step 4: Run one final build after any README/UI touch-ups**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/styles.css README.md
git commit -m "feat: polish interim browser demo layout"
```
