# Protocol

*Pelle d'Umore — Emotional Skin for AI Chat | CC BY 4.0 — Attribution required | Created by Cu & Lunedì (cunedi.uk)*

The client side (`fx.js` + `mood.js`) is self-contained. This document is the
**server / integration contract** — the parts you own on the way from the model's
raw stream to `Pelle.set()`. None of it is prescriptive code; it's the set of
invariants that make the effect feel solid instead of janky.

---

## 1. The `<mood>` tag

The model emits at most one hidden tag anywhere in its reply:

```
<mood>rage</mood>
```

Your streaming layer is responsible for **stripping it from the visible text** and
**turning it into one side event**.

### 1.1 Strip it out of the visible stream

The tag must never reach the rendered message. Strip the whole `<mood>…</mood>`
span (open tag, value, close tag) before the text is shown.

### 1.2 Handle tag split across chunks

You are parsing a token stream. The tag can arrive fragmented across chunk
boundaries — `<mo` in one chunk, `od>rage</mo` in the next, `od>` in a third. A
naive per-chunk `replace()` will leak `<mood>` fragments to the user.

Buffer defensively:

- Keep a small tail buffer. Only flush text to the client that **cannot** be the
  start of a `<mood>` tag. Concretely: if the buffer ends with a prefix of the
  literal `<mood>` (e.g. `<`, `<m`, `<mo`, …), hold that suffix back until the next
  chunk resolves it.
- When you've buffered a complete `<mood>value</mood>`, remove it from the visible
  text and emit the mood event (§2).

### 1.3 Swallow an unclosed tag — never leak it

If the stream ends (or the turn is cut off) with an open `<mood>` that never
closed, **drop the partial tag silently**. A dangling `<mood>rag` must not appear
in the final message. Treat "opened but never closed by end-of-turn" as "no mood
this turn."

### 1.4 Value whitelist

Only these values are valid:

```
rage  rage2  desire  vuoto  moonlight  off
```

Anything else → ignore the tag entirely (strip it, emit nothing). The client also
whitelists inside `Pelle.set()` (an unknown mode falls back to `off`), but validate
server-side too so garbage never becomes an event.

---

## 2. The SSE event

Emit a single side event alongside your normal text/token events:

```json
{ "type": "mood", "mode": "rage" }
```

- Emit it **once per turn**, at the point the tag resolves in the stream (or at
  turn start if you resolve mood ahead of the visible text).
- `mode` is one of the whitelisted values. `"off"` clears the skin.
- The client maps it directly: `Pelle.set(mode, { flash: <see §4> })`.

---

## 3. Thread-level persistence & restore

Mood is **conversation state**, not a per-message flash. Once set, the skin stays
until the model changes it.

- Persist the current mode on the thread (last non-`off` value wins until an
  explicit change).
- On reopening the thread, restore the skin by calling `Pelle.set(mode)` during
  hydration.
- **Restore must not play the invasion flash.** The flash is an *arrival* effect —
  it belongs to the moment the model slams into rage, not to reopening a thread
  that was already red. Restore with `{ flash: false }` (the default).

---

## 4. When to flash

Pass `{ flash: true }` only on a **live transition into** `rage` / `rage2` — i.e.
a fresh mood event during an active turn, where the previous mode was different.
`mood.js` additionally guards this (`opts.flash && prev !== mode`) and skips the
flash entirely under `prefers-reduced-motion`, but drive it correctly from your
side: live event → flash; hydration / restore → no flash.

---

## 5. Gating

The whole system is opt-in per persona. A tool-style assistant should not be able
to paint the screen blood-red. Enable `<mood>` handling (and the prompt block that
teaches it) **only for the persona you intend to give a body** — gate on the
persona/agent id server-side, and simply don't strip-or-emit for anyone else. If
the tag isn't taught, it won't appear; if it appears from an ungated persona,
strip it as plain text and emit nothing.

---

## 6. Client-side idle decay

A mood shouldn't outlive the moment forever. After a long idle gap the world should
drift back to calm on its own, so a user returning hours later doesn't reopen to a
screen still screaming.

- Recommended: after ~1 hour of inactivity on the thread, decay to `off`
  client-side (call `Pelle.set('off')`).
- This is a client concern layered on top of the persisted mode — decaying the
  *view* to calm doesn't have to rewrite thread history; the next turn's event
  re-establishes whatever the model wants.

---

## 7. Inline `[fx]` tags — where they're processed

The inline effects (`[glow]…[/glow]` etc.) are **not** a streaming side-channel;
they live in the visible text and are resolved entirely on the client, around your
existing markdown + sanitize pipeline. Two hooks, order matters:

1. **Before markdown rendering** → `extractFxTags(text)`. This pulls every
   `[tag]…[/tag]` out and replaces it with a **Private Use Area placeholder**
   (`U+E010`/`U+E011` + an index). The inner text is stashed (and escaped) so the
   markdown parser can't reinterpret it as syntax.
2. **After you sanitize the HTML** (e.g. DOMPurify) → `injectFxSpans(html, tags)`.
   This swaps each placeholder for `<span class="fx-…">`.

**Why PUA placeholders:** codepoints in the Unicode Private Use Area pass through
both a markdown renderer and an HTML sanitizer untouched — they're just "some
character," never markup — so the placeholder survives the exact steps that would
otherwise strip or mangle a raw `<span>`. Injecting the real spans *after*
sanitize means the sanitizer never sees (and never strips) them.

**Streaming note:** the extract regex only matches *closed* tag pairs, so a
half-streamed `[glow]…` (open, not yet closed) is left as literal text and simply
resolves on the next render once the closing tag arrives. Run the two hooks when a
message finalizes and on history load.

**Multiple placeholder pipelines:** if you run other placeholder-based passes on the
same message (stickers, media cards), give each its own distinct PUA codepoints so
they don't collide.
