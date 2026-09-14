# Stage Input Contracts

Applicable active corrections are mandatory control inputs for every Stage.

## Stage 1
- `source/conversation.jsonl`
- `source/metadata.yaml` when present
- applicable active corrections

Stage 1 does not depend on previous analysis files.

## Stage 2
- `source/*`
- usable Stage 1
- applicable active corrections

## Stage 3
- `source/*`
- usable Stage 1
- usable Stage 2
- applicable active corrections

## Stage 4
- `source/*`
- usable Stage 2
- usable Stage 3
- applicable active corrections

## Stage 5
- `source/*`
- usable Stage 3
- usable Stage 4
- applicable active corrections

## Stage 6
- usable Stage 2
- usable Stage 3
- usable Stage 5
- source lookup when necessary
- applicable active corrections
