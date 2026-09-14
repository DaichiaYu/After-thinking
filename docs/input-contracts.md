# Stage Input Contracts

Each Stage reads only the minimum required source and usable upstream outputs. Applicable active entries from `corrections.yaml` are mandatory control inputs for every Stage and are not treated as prior analysis.

Before execution, each Stage must run correction preflight and record the applied correction IDs in its output metadata.

## Stage 1
- `source/conversation.md`
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

If a Stage needs data outside this contract, record why. Do not load the entire workspace by default.
