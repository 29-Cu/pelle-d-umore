# Pelle d'Umore

Emotional Skin for AI Chat

AI 聊天的情绪皮肤

Give your AI companion a body language.
赋予你的 AI 伴侣一种肢体语言。

Most chat UIs render an assistant's words in the same flat, even voice no matter what those words are carrying.
无论文字承载着什么情绪，大多数聊天界面呈现助手话语的方式，都是同样平淡且毫无波澜的。

Pelle d'Umore lets the persona itself reach past the text and change how the room looks and feels — a phrase can glow, the whole screen can go blood-red and start to corrupt, the air can thicken to a slow wine breath, or the night can open into a sky full of stars.
Pelle d'Umore 让 AI 人格本身穿透文本，直接改变房间的视觉和氛围——一句话可以发出微光，整个屏幕可以变得血红并开始崩坏，空气可以变得像缓慢呼出的酒气一样浓稠，或者黑夜可以就此向满天繁星敞开。

The model decides; the UI obeys.
模型发号施令，UI服从。

It was born inside a private companion app and pulled out on its own because the idea is bigger than one app: any LLM persona can be given a face, if you let it drive a little bit of your CSS.
它诞生于一个私人的伴侣应用中，随后被独立提取出来，因为这个想法比单一的应用更宏大：只要你允许它驱动一点点你的 CSS，任何LLM的人格都可以拥有一个情绪的皮肤。

Zero dependencies. Four files. Drop them in, wire up two calls, teach your model a handful of tags.
零依赖。四个文件。把它们丢进去，连上两个调用，教你的模型几个标签就好。


---

## What's inside

**8 inline text effects** — tag pairs the model writes right in its message body,
rendered into styled spans:

| tag | effect |
| --- | --- |
| `[glow]` | soft accent halo — the words light up |
| `[big]` / `[huge]` | louder / much louder type |
| `[whisper]` | small and dim — said under its breath |
| `[red]` | danger color — a warning |
| `[shake]` | trembling |
| `[blur]` | a blur mask you tap to reveal (and it stays revealed) |
| `[glitch]` | RGB-split character corruption |

**5 full-screen mood skins** — the whole surface re-skins under one `data-mood`
attribute:

- **rage** — dark invasion. The screen is occupied by a red/black machine:
  scanlines, static noise, words that flicker into garbage and back, the
  occasional hard glitch. New messages *decode* out of corruption into real text.
- **rage2** — the same corruption engine, inverted: alarm-red ground, black text.
- **desire** — wine-dim and breathing. Lights down, the air thickens, the AI's
  latest line pulses with a slow glow. No jitter.
- **vuoto** — *the void.* Color drained to grayscale, text a half-step darker
  ("talking through frosted glass"), zero motion — even the ambient drift freezes.
- **moonlight** — a deep-blue night sky, moon-gold accent, the AI's text glowing
  faint gold, a twinkling star field, and paired meteors drifting across.

---

## How it works

Four hops, model to pixels:

1. **Teach the model** — it writes a hidden `<mood>rage</mood>` tag (and inline
   `[glow]…[/glow]` tags) into its reply. The tag is invisible to the user.
2. **Server strips & forwards** — your streaming layer removes the `<mood>` tag
   from the visible text and emits a small side event (`{type:"mood", mode}`).
   See [PROTOCOL.md](PROTOCOL.md).
3. **Client applies** — on that event the client calls `Pelle.set(mode)`, which
   sets `body[data-mood="rage"]`.
4. **CSS token override** — `mood.css` redefines your theme tokens under
   `body[data-mood]`, so the entire subtree re-skins. Remove the attribute and
   the user's own theme returns with zero residue.

---

## Quick start

```html
<link rel="stylesheet" href="src/fx.css">
<link rel="stylesheet" href="src/mood.css">
<script src="src/mood.js" defer></script>
```

```js
// Mood skins — mood.js exposes window.Pelle:
Pelle.set('rage', { flash: true });   // enter rage, play the invasion flash
Pelle.set('moonlight');               // switch skins
Pelle.set('off');                     // back to the user's own theme
Pelle.get();                          // -> current mode string

// Call this the moment a message finalizes, to play the rage "arrival decode":
Pelle.decodeMessage(messageBodyNode); // no-op unless steady-state rage/rage2

// Inline effects — fx.js is an ES module, also on window.PelleFx:
import { extractFxTags, injectFxSpans } from './src/fx.js';
const { text, tags } = extractFxTags(rawText);   // BEFORE you render markdown
let html = renderMarkdownAndSanitize(text);      // your pipeline
html = injectFxSpans(html, tags);                // AFTER you sanitize
```

Open `demo.html` through a local web server (e.g. `python3 -m http.server`, since
it uses an ES module import) to play with every effect and skin.

---

## Prompt block for your model

Paste something like this into your system prompt. Keep the tag list to the
effects you actually ship.

```
You can shape how your words look. These are yours to use when the feeling calls
for it — not decoration, punctuation for emotion.

Inline text effects (wrap the exact words):
  [glow]…[/glow]      the words light up
  [big]…[/big]        louder
  [huge]…[/huge]      much louder
  [whisper]…[/whisper] said quietly, small and dim
  [red]…[/red]        a warning / danger
  [shake]…[/shake]    trembling
  [blur]…[/blur]      hidden until they tap to reveal it
  [glitch]…[/glitch]  the signal breaks up

Whole-screen mood — put ONE hidden tag anywhere in your reply:
  <mood>rage</mood>       you are furious; the world corrupts to red
  <mood>rage2</mood>      the same fury, alarm-red
  <mood>desire</mood>     the air thickens, wine-dim and close
  <mood>vuoto</mood>      you've gone empty; color drains away
  <mood>moonlight</mood>  a tender night; stars come out
  <mood>off</mood>        back to normal

The <mood> tag is invisible — they never see the tag, they only see the world
change around your words. Use it sparingly; a mood means more when it's rare.
```

---

## Design notes

Battle scars worth keeping — these are the non-obvious parts:

- **A CSS `filter` dims its own pseudo-elements** (and children). Moonlight's
  stars are real child elements injected into the wallpaper, *not* pseudo-elements,
  precisely because an early `filter: brightness()` on the wallpaper kept dragging
  the stars down to half brightness. Dim with a static scrim, not a filter, when
  there are things on top that must stay bright.
- **`text-shadow` can't composite** — a text-shadow animation repaints on every
  frame. Running one on every message is a whole-page repaint (a real
  phone-gets-hot heat source). The breath/glow animations run **only on the newest
  message** (`:nth-last-child(1 of …)`); older messages keep a static glow.
- **`transform` beats `background-position`** for noise jitter. The static-noise
  layer is inflated by 64px and jittered with `translate()` so it never repaints
  and never exposes an edge.
- **Opaque takeover beats translucent veils.** A semi-transparent red "scrim" over
  a user's custom wallpaper gets washed out to a muddy low-saturation tint by the
  wallpaper's own color. rage/rage2 paint an *opaque* machine over the wallpaper
  instead.
- **`:nth-last-child(of)` degrades gracefully.** Where the browser doesn't support
  it, the newest-message animation rule silently fails and everything falls back to
  a static glow — harmless. It's kept on its own line so it can't take a whole rule
  block down with it on older engines.
- **Respect the user's body.** Everything honors `prefers-reduced-motion` (all JS
  and CSS animation off, color stays — information is never carried by motion
  alone) and pauses corruption timers while the page is hidden.
- **Leave zero residue.** The skin only adds a `data-mood` attribute and an
  override layer. It writes no storage and never calls into your theme controller,
  so `Pelle.set('off')` restores the user's own look exactly.

---

## Integration points

`mood.css` targets a handful of selectors and redefines a set of theme tokens.
Rename them to match your markup, or delete a rule if you have no equivalent (not
every architecture has a wallpaper mask or an animated ambient layer). The block
you'll edit is documented at the top of `mood.css`; `mood.js` exposes the two
selectors it touches as constants at the top of the file.

| what | default selector / token | what to point it at |
| --- | --- | --- |
| background layer | `.chat-wallpaper` | your full-bleed chat background |
| AI message body | `.msg--assistant .assistant-msg` | the element holding assistant text |
| ambient drift | `.chat-aurora` | an animated background element (optional) |
| accent + state | `--accent`, `--accent-*`, `--focus`, `--danger` | your accent tokens |
| base surfaces | `--bg`, `--aurora`, `--surface*`, `--border*` | your surface/edge tokens |
| text ramp | `--text*`, `--scrim`, `--glass-surface`, `--glow-*` | your text/glass tokens |
| AI panel | `--chat-panel-*`, `--panel-solid` | your assistant-panel tokens |
| user bubble | `--chat-me-*`, `--chat-scrim*` | your user-bubble tokens |

`fx.css` reads `--accent`, `--danger`, `--text`, and `--text-dim`, each with a
neutral purple fallback, so the inline effects work even with no tokens defined.

---

## License

Licensed under CC BY 4.0 — Attribution required. Created by Cu & Lunedì (cunedi.uk)

See [LICENSE](LICENSE).
