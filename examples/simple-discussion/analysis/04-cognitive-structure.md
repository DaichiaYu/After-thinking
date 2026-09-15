---
workflow_version: "0.1"
stage: 4
source_revision: 1
applied_corrections: []
completion:
  exit_criteria_met: true
  blocking_items: []
  nonblocking_uncertainties: []
  stop_reason: "One recurring source-bounded distinction is supported."
---

## CS001 — Separate reconstruction state from downstream use
- kind: recurring_distinction
- observation: In this material, the author repeatedly separates what the discussion record should faithfully represent from what may later be done with that record.
- scope: supplied_material
- topic_ids: [T001, T002]
- claim_ids: [C001, C003]
- reasoning_turn_ids: [R001, R002]
- evidence_refs: [msg-000001, msg-000002, msg-000004, msg-000006]
- confidence: high
- uncertainty: null
