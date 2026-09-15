---
workflow_version: "0.1"
stage: 6
source_revision: 1
applied_corrections: []
completion:
  exit_criteria_met: true
  blocking_items: []
  nonblocking_uncertainties: []
  stop_reason: "The single Direction is traceable to G001."
---

## D001 — Compare reconstruction with and without provenance
- related_gap: G001
- derived_from: missing_evidence
- next_question: Does explicit provenance plus author-uptake tracking reduce attribution errors compared with a conventional summary?
- why_this_matters: It tests whether the accepted design rule produces the intended reconstruction benefit.
- expected_impact: The result could support, narrow, or reject C002 as an implementation rule.
- required_input: A small set of the same conversations reconstructed by both methods plus an attribution-error review.
- priority: High
