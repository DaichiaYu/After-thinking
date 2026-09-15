# Cross-Stage runtime documents

Stage-specific rules live only in `../specs/`. Do not duplicate Stage schemas, enums, review policies, or exit criteria under `docs/`.

- `runtime.md` — cross-Stage runtime entry point and rollback/stale propagation.
- `workspace-write-contract.md` — destination, initialization, and write order.
- `storage-model.md` — workspace structure and object families.
- `source-format.md` — source identity, order, mutation, and revision authority.
- `id-lifecycle.md` — stable object IDs across reruns, split, merge, and retirement.
- `state-semantics.md` — execution/review states, rerun reset, confirmation evidence, next actions.
- `user-fixes.md` — persistent user corrections and direct applicability.
- `uncertainty-semantics.md` — uncertainty as a valid analytical result.
- `input-contracts.md` — minimum Stage inputs.
- `output-format.md` — common run/completion metadata.
- `analysis-boundary.md` — separation between reconstruction and downstream publication.
- `example-workspace.md` — pointer to the filled example workspace.

Starter files are under `../templates/`; a complete example is under `../examples/simple-discussion/`.
