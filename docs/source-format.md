# Canonical Source Format

Raw conversation source is UTF-8 JSON Lines at `source/conversation.jsonl`. Each line is one source item. Preserve original `content` as supplied; analysis must not rewrite raw source.

Canonical record:

```json
{"message_id":"msg-000001","order":10,"speaker":"author","content":"Original text","timestamp":"2026-09-14T07:35:12+08:00"}
```

Required fields are `message_id`, `order`, `speaker`, `content`, and `timestamp` (`timestamp` may be null). Allowed speakers are `author`, `assistant`, and `external`.

## Identity vs order

`message_id` is permanent identity and never encodes speaker, chronology, or array position. Existing IDs are never renumbered or reused.

`source/metadata.yaml.message_id_counter` records the highest allocated sequential message number. New source items increment that counter and receive a never-before-used ID, including items inserted before older messages or after deletions.

`order` determines canonical reading order. It may change when material is inserted or reordered. Executors sort by `order`, not by message ID or timestamp. `order` values must be unique within the current source revision. Spaced integers such as 10, 20, 30 are convenient; order values may later be normalized without changing message IDs.

## Source mutations

Supported mutations:

- `append`: add material after existing items;
- `insert`: add previously omitted material anywhere in canonical order;
- `edit`: correct/replace an existing source item while preserving identity when it remains the same source item;
- `delete`: remove an item from the current source while reserving its message ID permanently.

Every semantic source mutation increments `source_revision` and triggers stale evaluation from the earliest affected Stage. Reordering without semantic effect still increments source revision but need not propagate stale when analysis references remain semantically unchanged.

## Source revision authority

`source/metadata.yaml.source_revision` is authoritative. `state.yaml.source.revision` is a synchronized mirror for fast resume. If they disagree, execution is `blocked` until synchronized; do not guess which value is current.

## Source links cited by the assistant

An assistant item may carry an optional `sources` array holding the web addresses the AI cited, so a claim stays traceable from the record itself without reopening the original conversation:

```json
{"message_id":"msg-000002","order":20,"speaker":"assistant","content":"The limit was raised in 2024.[來源 1]","timestamp":null,"sources":[{"n":1,"url":"https://example.org/report","title":"Annual report","inline":true}]}
```

- `n` is the number used by `[來源 n]` markers in the same item's `content` (`[來源 1、2]` cites several). Numbers are local to one item.
- `url` is always an absolute `http(s)` address; `title` may be null.
- `inline: true` means a marker in `content` points at this entry. `inline: false` means the link was part of the answer text itself but its position was lost (text read from the screen keeps only the link's label).
- `[來源：未取得網址]` in `content` marks a citation whose address the platform did not provide. It is never left as a bare marker.
- Marker text is fixed and does not follow the interface language.

### Consulted pages (separate file)

Platforms often list the pages an answer drew on without tying them to a sentence, sometimes dozens per answer. These are **not** stored in `conversation.jsonl`. They go to `source/consulted-sources.jsonl`, one line per message:

```json
{"message_id":"msg-000002","platform_message_id":"…","sources":[{"url":"https://example.org/a","title":"A"}]}
```

The message itself carries only `consulted_sources` (the count). `source/metadata.yaml` lists the file under `source_files` with `role: consulted_sources`. Executors do not load this file by default; read it only to check what an answer may have drawn on. An entry here is not evidence that a particular sentence came from that page.

Records captured before this field existed have no `sources`; the addresses were not stored and can only be recovered by capturing the conversation again.

External material may use `speaker: external` and additional bibliographic/URL fields. Analysis files cite stable `message_id` values as source references.
