// Pelle d'Umore — Emotional Skin for AI Chat | CC BY 4.0 — Attribution required | Created by Cu & Lunedì (cunedi.uk)
//
// fx.js — inline text effects.
//
// Tag pairs inside the AI's message body render into styled <span>s:
//   [glow]…[/glow] [big] [huge] [whisper] [red] [shake] [blur] [glitch]
// Eight effects, lowercase, no nesting. Inner content is escaped as plain
// text (inner markdown is NOT re-parsed).
//
// The trick — a Private Use Area (PUA) placeholder recipe that slips past a
// markdown renderer AND an HTML sanitizer (e.g. DOMPurify) without being
// mangled:
//   1) BEFORE renderMarkdown → extractFxTags(): swap every [tag]…[/tag] for a
//      PUA placeholder and stash the escaped inner text in tags[], so the
//      markdown parser never treats the inner text as markdown syntax.
//   2) AFTER sanitize (and any other placeholder passes) → injectFxSpans():
//      replace the placeholder literals with <span class="fx-…">.
// Unclosed tags (a stream that only wrote the opening tag so far) don't match
// the regex → they're left as-is until the final text arrives.
//
// PUA codepoints survive marked/DOMPurify as literal text. If you run other
// placeholder-based pipelines (stickers, media cards) on the same message,
// give each pipeline distinct PUA codepoints so they don't collide.
//
// [blur] = a blur mask that reveals on click (or keyboard Enter/Space) and
// stays revealed. The reveal handler is delegated on `document` and bound once.
//
// Wire-up: call extractFxTags() right before you render markdown, and
// injectFxSpans() right after you sanitize. Styling lives in fx.css.

// Minimal HTML escaper (inlined so this file has no imports).
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Eight effects, lowercase, no nesting. The \1 backreference forces the
// closing tag to match the opening tag name.
const FX_RE = /\[(glow|big|huge|whisper|red|shake|blur|glitch)\]([\s\S]*?)\[\/\1\]/g;

// Private Use Area placeholders (U+E010 / U+E011) — marked / DOMPurify both
// keep them verbatim as plain text rather than interpreting them as markup.
const PH_OPEN = "";
const PH_CLOSE = "";

// ── Public: pull tags out BEFORE markdown rendering ──
export function extractFxTags(text) {
  const tags = [];
  if (!text) return { text: text || "", tags };
  const out = String(text).replace(FX_RE, (m, name, inner) => {
    const i = tags.length;
    tags.push({ name: name, inner: inner });
    return PH_OPEN + "fx" + i + PH_CLOSE;
  });
  return { text: out, tags };
}

// ── Public: AFTER sanitize (and any other placeholder passes), swap
//    placeholders for effect spans ──
export function injectFxSpans(html, tags) {
  if (!tags || !tags.length) return html;
  _ensureDelegation();
  let out = html;
  tags.forEach((tag, i) => {
    const ph = PH_OPEN + "fx" + i + PH_CLOSE;
    out = out.split(ph).join(buildSpanHtml(tag));  // literal split/join → no regex-escaping the PUA chars
  });
  return out;
}

function buildSpanHtml(tag) {
  const inner = escapeHtml(tag.inner);   // plain-text escape, no inner markdown
  const cls = "fx-" + tag.name;
  if (tag.name === "blur") {
    // Reveals on click via the delegated handler (adds .fx-revealed).
    return '<span class="' + cls + '" role="button" tabindex="0" aria-label="Reveal">' + inner + '</span>';
  }
  if (tag.name === "glitch") {
    // data-text feeds the ::before/::after pseudo-elements that duplicate the
    // text for the RGB-split corruption flicker (already escaped for the attribute).
    return '<span class="' + cls + '" data-text="' + inner + '">' + inner + '</span>';
  }
  return '<span class="' + cls + '">' + inner + '</span>';
}

// ── Delegation: click (or Enter/Space) on a [blur] span reveals it and keeps
//    it revealed. Bound on document, once. ──
let _delegated = false;
function _ensureDelegation() {
  if (_delegated) return;
  _delegated = true;
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".fx-blur");
    if (!b || b.classList.contains("fx-revealed")) return;
    b.classList.add("fx-revealed");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const b = e.target.closest && e.target.closest(".fx-blur");
    if (!b || b.classList.contains("fx-revealed")) return;
    e.preventDefault();
    b.classList.add("fx-revealed");
  });
}

// Also expose on window for non-module callers (keeps the ESM exports above).
if (typeof window !== "undefined") {
  window.PelleFx = { extractFxTags: extractFxTags, injectFxSpans: injectFxSpans };
}
