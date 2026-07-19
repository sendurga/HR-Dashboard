# Performance Tab & Leakage Metrics Validation

This document captures key discoveries, mathematical validations, and architectural logic shifts regarding how candidate leakage and performance metrics are calculated in the HR Dashboard.

## 1. Candidate Drops vs. Screen/Interview Drops

A common point of confusion during validation was the discrepancy between the "Candidate Drops" (128) in the Pipeline Leakage Points tile and the "Screen / Interview Drops" (122) in the Recruitment Funnel tile. 

### Why the difference?
They measure two fundamentally different things:
- **Screen / Interview Drops (Funnel Gap):** This is a strict mathematical gap between two funnel stages: `Shortlisted - Interviewed`. It represents anyone who passed screening but failed to reach an interview, regardless of reason (includes No-Shows and mid-pipeline withdrawals).
- **Candidate Drops (Leakage Tile):** Following a logic update, this metric was dynamically restricted to only count candidate withdrawals that occur specifically during the `Screening -> Interview` window. It iterates through the dataset and increments only when a candidate simultaneously meets three conditions:
  1. They successfully reached shortlisting (`stageIsShort`).
  2. They did **not** reach the interview stage (`!stageIsInterview`).
  3. They are marked as a drop (`isDrop`).

By restricting the `Candidate Drops` logic to this specific window, the leakage tile now aligns functionally with the Funnel Gap (with the exception of No-Shows, which are tracked in their own separate leakage bucket).

## 2. Refactoring to "Highest Stage Reached"

Per the lead's directive, we transitioned the primary source of truth for candidate evaluation from the `Status` column to the `Highest Stage Reached` column. The `Status` column in the Google Sheet is often inconsistently updated by recruiters, whereas `Highest Stage Reached` offers a more structural view of the candidate's journey.

### Logic Implementation (`dashboard-data.ts`)
- **Joined, Offered, Candidate Drops, No-Shows:** Now exclusively evaluate the `Highest Stage Reached` column.
  - *Example:* A candidate with `Highest Stage Reached` = `3.Screened (Candidate Drop)` is correctly bucketed as a Candidate Drop.
  - *Example:* A candidate with `Highest Stage Reached` = `4.Screened (Interview No-Show)` is correctly bucketed as a No-Show.
- **Rejects & Offer Drops:** Because the `Highest Stage Reached` column often generically states `5. Interviewed` or `2. Screened` without indicating a rejection, we continue to rely on the `Status` column to accurately classify `R1 Rejects`, `R2 Rejects`, `Screen Rejects`, and `Offer Drops`.

## 3. Fixing Legacy "Drop" Misclassifications

During validation, we discovered and fixed two major bugs in the `STATUS_PATTERNS.dropped` regex that were artificially inflating the "Candidate Drops" metric:

1. **"On Hold":** The regex previously captured `/on.?hold/i` as a Candidate Drop. "On Hold" typically means the requisition or candidate process is paused by the company, not that the candidate dropped out. We removed this from the `dropped` patterns.
2. **Offer Declines:** The regex previously captured `/declined/i` as a general Candidate Drop. However, candidates whose status is "Declined" but who reached the `6. Offered` stage were actually rejecting an offer. We updated the logic to cross-reference the stage; if they reached the Offer stage and declined, they are now correctly bucketed into **Offer Drops** instead of generic Candidate Drops.

## 4. Pre-Interview Leakage Warning Note

The warning note at the bottom of the Pipeline Leakage tile previously stated:
`⚠ [X] screen rejects + [Y] candidate drops = [Z] lost before interview`

This was mathematically and logically misleading, as the global `Candidate Drops` metric includes post-interview withdrawals. The UI was updated to dynamically calculate true pre-shortlist leakage using the formula:
`Total Applicants - Shortlisted = Candidates lost before reaching the shortlisting/interview stage.`
