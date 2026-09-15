# Stable Object ID Lifecycle

Object IDs represent logical identity, not list position or source order.

Prefixes: `T` Topic, `R` reasoning turn, `C` Claim, `CS` cognitive-structure observation, `G` Gap, `D` Direction, `CR` Correction. Stage 1 uses fixed `S1.*` anchors.

## Rerun rules

- Same logical object with revised wording, evidence, confidence, or fields → keep its ID.
- Newly discovered logical object → allocate a new ID from the monotonic counter.
- Object no longer supported → retire its ID; never reuse it.
- Split one object → retire the old ID and allocate new IDs for all resulting objects.
- Merge multiple objects → retire all old IDs and allocate one new ID for the merged object.

Match rerun objects by semantic identity plus source/evidence anchors, not by array position.

## Counters and retirement registry

`state.yaml` stores monotonic counters and a retirement registry:

```yaml
id_counters:
  topic: 0
  reasoning_turn: 0
  claim: 0
  cognitive_structure: 0
  gap: 0
  direction: 0
  correction: 0

identity_state:
  retired_objects:
    - id: C003
      stage: 3
      reason: split
      replacements: [C007, C008]
      source_revision: 2
```

Counters never decrease. A retired ID is recorded even when it has no replacement. `replacements` may be empty for removal, contain several IDs for split, or one new ID for merge. This lets future executors distinguish "never existed" from "existed and was retired."

## Correction safety

If a retired/split/merged object has an active correction, do not guess a new target. Set the owning Stage to `blocked`, add a correction conflict, and request explicit user resolution. Candidate replacements do not authorize automatic correction retargeting.
