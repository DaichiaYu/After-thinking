# Canonical Source Format

Raw conversation source is stored as UTF-8 JSON Lines at `source/conversation.jsonl`.

Each line is one source item. The original `content` is preserved as supplied and is not rewritten by the analysis model.

Required fields:

```json
{"message_id":"msg-000001","speaker":"author","content":"Original text","timestamp":"2026-09-14T07:35:12+08:00"}
```

Allowed `speaker` values:

- `author`
- `assistant`
- `external`

`timestamp` may be `null` when the source does not provide one.

`message_id` is stable and does not encode speaker role. Use sequential IDs such as `msg-000001`, `msg-000002`, and never renumber existing items after append.

External material may use the same container with `speaker: external`; bibliographic or URL metadata may be stored in additional fields without changing the original `content`.

Analysis files cite `message_id` values as source references.

JSONL is used instead of a Markdown transcript because it keeps provenance fields machine-readable while remaining append-friendly. `source/metadata.yaml` stores discussion-level source metadata rather than message text.
