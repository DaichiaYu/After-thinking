# Canonical Source Format

Raw conversation source is UTF-8 JSON Lines at `source/conversation.jsonl`. Each line is one source item. Preserve original `content` as supplied; analysis must not rewrite raw source.

Canonical record:

```json
{"message_id":"msg-000001","order":10,"speaker":"author","content":"Original text","timestamp":"2026-09-14T07:35:12+08:00"}
```

Required fields are `message_id`, `order`, `speaker`, `content`, and `timestamp` (`timestamp` may be null). Allowed speakers are `author`, `assistant`, and `external`.

## Identity vs order

`message_id` is permanent identity and never encodes speaker, chronology, or array position. Existing IDs are never renumbered or reused.

`order` determines canonical reading order. It may change when material is inserted or reordered. Executors sort by `order`, not by message ID or timestamp. `order` values must be unique within the current source revision. Use spaced integers (for example 10, 20, 30) when convenient; a source rewrite may normalize order values without changing message IDs.

## Source mutations

Supported mutations are:

- `append`: add material after existing items;
- `insert`: add previously omitted material anywhere in canonical order;
- `edit`: correct or replace the content/metadata of an existing source item while preserving its identity when it is still the same source item;
- `delete`: remove an item from the current source while reserving its message ID permanently.

Every semantic source mutation increments `source_revision` and triggers stale evaluation from the earliest affected Stage. Reordering without semantic effect still increments the source revision but does not require downstream stale propagation if analysis references remain semantically unchanged.

New items always receive never-before-used message IDs, even when inserted before older items.

## Source revision authority

`source/metadata.yaml.source_revision` is authoritative. `state.yaml.source.revision` is a synchronized mirror for fast resume. If they disagree, execution is `blocked` until synchronized; the executor must not guess which value is current.

External material may use `speaker: external` and additional bibliographic or URL fields. Analysis files cite stable `message_id` values as source references.
