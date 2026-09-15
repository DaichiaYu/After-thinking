# Stage Input Contracts

Read only the minimum inputs needed by the current Stage. Active corrections are direct control inputs only when they target an object owned by the current Stage; downstream effects arrive through corrected upstream outputs.

## Stage 1
- `source/conversation.jsonl`
- `source/metadata.yaml`
- active Stage 1 corrections

## Stage 2
- `source/*`
- usable Stage 1
- active Stage 2 corrections

## Stage 3
- `source/*`
- usable Stage 1
- usable Stage 2
- active Stage 3 corrections

## Stage 4
- `source/*`
- usable Stage 2
- usable Stage 3
- active Stage 4 corrections

## Stage 5
- `source/*`
- usable Stage 2
- usable Stage 3
- usable Stage 4
- active Stage 5 corrections

Stage 2 is required because Topic and reasoning-turn structure may be needed for `Interrupted branch` and other traceability.

## Stage 6
- usable Stage 2
- usable Stage 3
- usable Stage 5
- source lookup when necessary
- active Stage 6 corrections
