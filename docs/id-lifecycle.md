# Stable Object ID Lifecycle

Object IDs represent logical identity, not list position or source order.

Prefixes:

- `T` — Topic
- `R` — reasoning turn
- `C` — Claim
- `CS` — cognitive-structure observation
- `G` — Gap
- `D` — Direction
- `CR` — Correction

Stage 1 uses fixed anchors such as `S1.scope` and `S1.author_initial_position`.

## Rerun rules

- Same logical object with revised wording, evidence, confidence, or fields → keep the existing ID.
- Newly discovered logical object → allocate a new ID from the next counter value.
- Object no longer supported → retire the ID; never reuse it.
- Split one object into multiple objects → retire the old object and allocate new IDs for all resulting objects.
- Merge multiple objects → retire the old objects and allocate one new ID for the merged object.

Executors should match rerun objects by semantic identity plus source/evidence anchors, not by array position.

## Correction safety

If a retired, split, or merged object has an active correction, do not guess a new correction target. Set the affected Stage to `blocked`, add a correction conflict, and request explicit user resolution.

## Counters

`state.yaml` stores monotonic counters. Counters never decrease and retired IDs are never returned to the pool.

```yaml
id_counters:
  topic: 0
  reasoning_turn: 0
  claim: 0
  cognitive_structure: 0
  gap: 0
  direction: 0
  correction: 0
```
