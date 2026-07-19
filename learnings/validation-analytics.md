# Learnings — Analytics Tab: Open Positions Timeline Enhancement

> Session date: 2026-07-19

---

## Feature Added

**JD Received Date pointer on the Open Positions Timeline Gantt chart** (Analytics tab).

---

## 1. Column Detection — `kpi-config.ts`

New entry added to `COLUMN_CANDIDATES`:

```ts
jdReceivedDate: ['jd received date', 'jd received'],
```

- Column name in the data file: **`JD Received Date`**
- The `findCol()` helper lowercases headers and tries partial matches, so case differences are handled automatically.
- Always add both the full exact name and a shortened alias to be safe.

---

## 2. Backend Processing — `dashboard-data.ts`

### Column resolution
```ts
const jdReceivedDateKey = findCol(allKeys, COLUMN_CANDIDATES.jdReceivedDate)
```
Resolved before the main loop, alongside all other date keys.

### `buPositionMap` shape
`stages.jdReceived: number[]` added to the per-position accumulator alongside `reqStart`, `appStart`, `screen`, `r1`, `r2`, `r3`, `task`, `offer`.

### `getDiff()` — signed difference
```ts
const getDiff = (key: string) => {
  const d = parseDate(row[key] || '')
  if (d) return Math.round((d.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24))
  return null
}
```

> **Critical:** The guard `d >= reqDate` was intentionally removed so that **negative values are allowed**. JD Received often arrives *before* the formal Req Date, producing a negative day count. This is expected and correct.

### Average computation
```ts
jdReceived: d.stages.jdReceived.length > 0
  ? Math.round(d.stages.jdReceived.reduce((a, b) => a + b, 0) / d.stages.jdReceived.length)
  : null,
```
Arithmetic mean, rounded to whole days, `null` when no data.

---

## 3. Type System — `DashboardData` interface (`index.tsx`)

`jdReceived: number | null` added to `avgStages` in **two places**:
1. The `hiringTimelineByBU` interface in `index.tsx` (frontend type).
2. The `hiringTimelineByBU` return object in `dashboard-data.ts` (backend).

Both must stay in sync.

---

## 4. Chart Rendering — `PositionTimelinePlot` (`index.tsx`)

### Color choice
`#6366F1` (Indigo) — chosen because all existing stage colours are warm/amber/orange/red/green. Indigo provides maximum contrast and signals "input / trigger" rather than a process outcome.

### STAGES entry
```ts
{ key: 'jdReceived', label: 'JD Received', shortLabel: 'JD', color: '#6366F1',
  tooltipDef: 'When the Job Description was received (days from Req Date)' },
```
Placed **first** in the `STAGES` array so it always renders leftmost (dots are sorted by value, and JD Received is typically the earliest milestone).

---

## 5. X-Axis Scaling — supporting negative days

The original axis assumed `minDays = 0`. This was incorrect once JD Received can be negative.

**Fix:**
```ts
let maxDays = 10
let minDays = 0   // expands to negative if jdReceived < 0
filteredData.forEach(p => {
  Object.values(p.avgStages || {}).forEach(val => {
    if (val !== null && val > maxDays) maxDays = val
    if (val !== null && val < minDays) minDays = val
  })
})
const range = maxDays - minDays || 1
```

All positional calculations now use:
```ts
leftPct = ((val - minDays) / range) * 100
```
instead of the old `(val / maxDays) * 100`.

This applies to:
- Milestone dot position
- Connector bar `left` and `width`
- X-axis tick labels

---

## 6. Day 0 Visual Rule

When `minDays < 0`, a dashed vertical line is drawn on each Gantt row to mark **Day 0 (Req Date)**:

```tsx
{minDays < 0 && (
  <div style={{
    position: 'absolute',
    left: `${((0 - minDays) / range) * 100}%`,
    top: 0, bottom: 0,
    width: 0,
    borderLeft: '1.5px dashed rgba(15,23,42,0.3)',
    pointerEvents: 'none',
  }} />
)}
```

And a corresponding label in the axis header:
```tsx
{minDays < 0 && (
  <div style={{
    position: 'absolute',
    left: `${((0 - minDays) / range) * 100}%`,
    transform: 'translateX(-50%)',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  }}>
    Day 0
  </div>
)}
```

---

## 7. Tooltip Logic — Bug Fixes

### Old (buggy) approach
```ts
const prevVal = i > 0 ? (validStages[i - 1].val as number) : 0;
const stageDays = val - prevVal;
// Bug: if val is negative, stageDays = (negative) - 0 = wrong negative number shown
```

### Correct approach
```ts
if (i === 0) {
  tooltipBody = val < 0
    ? `${Math.abs(val)}d before Req Date`
    : `Day ${val} from Req Date`;
} else {
  const prevVal = validStages[i - 1].val as number;
  tooltipBody = `${val - prevVal}d from ${prevLabel}`;
}
```

**Rule:** The first milestone is always measured from Day 0 (Req Date). If it is negative, display "before Req Date". Subsequent milestones show delta from the previous stage.

---

## 8. Dev Server Restart Requirement

Netlify Functions running under `netlify dev` do **not** hot-reload TypeScript changes automatically.

> **Always restart `npm run dev`** after editing any file under `netlify/functions/`. Frontend (Vite) changes hot-reload normally.

---

## 9. Checklist for Adding a New Date Pointer to Timeline

- [ ] Add column candidates to `COLUMN_CANDIDATES` in `kpi-config.ts`
- [ ] Resolve key with `findCol()` in `dashboard-data.ts`
- [ ] Add array to `stages` in `buPositionMap` initialiser
- [ ] Collect diffs inside the `if (reqDate)` block (remove `>= reqDate` guard if negative values are valid)
- [ ] Compute average in `avgStages` output object
- [ ] Add `null | number` field to `DashboardData` type in `index.tsx`
- [ ] Add entry to `STAGES` array with a contrasting colour and tooltip definition
- [ ] Ensure `minDays` tracking covers negative values
- [ ] All positional formulas use `(val - minDays) / range`
- [ ] Add Day 0 rule if `minDays < 0`
- [ ] Restart dev server
