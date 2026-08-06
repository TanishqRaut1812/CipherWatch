---
version: alpha
name: CipherWatch-design-system
description: A dark, trading-terminal-inspired SOC interface for a metadata-only insider threat platform. The canvas stays near-black at all times — there is no light-mode transactional flip, because CipherWatch has no consumer checkout flow to justify one. A single accent, CipherWatch Yellow (#FCD535), carries every primary CTA, brand mark, and privacy-guarantee headline. Risk is communicated through the same green-up/red-down semantics as a price ticker, repurposed so that green means "contained" and red means "escalating" instead of "gaining value." The system trusts flat color-block cards and hairline dividers over gradients or shadows — restraint is the visual argument for a tool whose whole premise is restraint.

colors:
  primary: "#fcd535"
  primary-active: "#f0b90b"
  primary-disabled: "#3a3a1f"
  ink: "#181a20"
  body: "#eaecef"
  body-on-light: "#181a20"
  muted: "#707a8a"
  muted-strong: "#929aa5"
  hairline-on-light: "#eaecef"
  hairline-on-dark: "#2b3139"
  border-strong: "#cdd1d6"
  canvas-dark: "#0b0e11"
  surface-card-dark: "#1e2329"
  surface-elevated-dark: "#2b3139"
  surface-soft-light: "#fafafa"
  on-primary: "#181a20"
  on-dark: "#ffffff"
  risk-contained: "#0ecb81"
  risk-escalating: "#f6465d"
  info: "#3b82f6"

typography:
  hero-display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1px
  display-lg:
    fontFamily: "Inter, sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.5px
  display-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0
  title-lg:
    fontFamily: "Inter, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.35
  title-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  number-display:
    fontFamily: "Inter, sans-serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.3px
    fontVariantNumeric: tabular-nums
  number-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: 16px
    fontWeight: 500
    fontVariantNumeric: tabular-nums
  body-md:
    fontFamily: "Inter, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "Inter, sans-serif"
    fontSize: 14px
    fontWeight: 600
  nav-link:
    fontFamily: "Inter, sans-serif"
    fontSize: 14px
    fontWeight: 500

rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 80px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 40px
  button-primary-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 14px 32px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
  button-review:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 6px 16px
    height: 28px
  top-nav-dark:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.nav-link}"
    height: 64px
    border-bottom: "1px solid {colors.hairline-on-dark}"
  hero-band-dark:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.hero-display}"
    padding: 80px 40px 60px
  eyebrow-pill:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.muted-strong}"
    rounded: "{rounded.pill}"
    padding: 6px 14px
  search-input-on-dark:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg} 0 0 {rounded.lg}"
    padding: 10px 16px
    height: 40px
  trust-badge:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.lg}"
    padding: 16px 20px
  stat-callout-card:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.number-display}"
  alert-feed-card:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.xl}"
    padding: 24px
  alert-tab:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    textColor-active: "{colors.on-dark}"
    underline-active: "{colors.primary}"
  alert-row:
    backgroundColor: transparent
    textColor: "{colors.on-dark}"
    padding: 12px 0
    border-bottom: "1px solid {colors.hairline-on-dark}"
  pattern-icon-chip:
    backgroundColor: "{colors.surface-elevated-dark}"
    rounded: "{rounded.lg}"
    size: 32px
  risk-contained-cell:
    backgroundColor: transparent
    textColor: "{colors.risk-contained}"
    typography: "{typography.number-sm}"
  risk-escalating-cell:
    backgroundColor: transparent
    textColor: "{colors.risk-escalating}"
    typography: "{typography.number-sm}"
  session-graph-card:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.xl}"
    padding: 24px
  zero-content-band:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.primary}"
    typography: "{typography.display-lg}"
    padding: 80px 40px
    align: center
  faq-row:
    backgroundColor: transparent
    textColor: "{colors.on-dark}"
    typography: "{typography.title-sm}"
    padding: 20px 0
    border-bottom: "1px solid {colors.hairline-on-dark}"
  cta-band-dark:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-sm}"
    rounded: "{rounded.xl}"
    padding: 48px
  footer-light:
    backgroundColor: "{colors.surface-soft-light}"
    textColor: "{colors.body-on-light}"
    typography: "{typography.body-md}"
    padding: 64px 40px
---

## Overview

CipherWatch reads like a SOC analyst's trading terminal — dark, dense, and built for fast pattern recognition rather than persuasion. The base atmosphere is **near-black canvas** (`{colors.canvas-dark}` — #0b0e11), holding off-white body type and a single accent: **CipherWatch Yellow** (`{colors.primary}` — #FCD535). Unlike a consumer product, the whole surface stays dark end-to-end — there's no light-mode transactional flip, because there's no checkout or deposit flow to justify one. Every screen an analyst works in is the same terminal.

Risk communication borrows the green-up/red-down vocabulary of a price ticker, but repoints its meaning: `{colors.risk-contained}` (green) marks resolved or low-risk sessions, `{colors.risk-escalating}` (red) marks sessions trending toward exfiltration. The arrow direction still reads as "worse" pointing up and "better" pointing down, matching how an analyst already scans a risk column.

**Key characteristics:**
- Single accent color: `{colors.primary}` does all brand and CTA work — never used for body text or large fills.
- One canvas mode only: dark, always. The footer is the one deliberate inversion (`{colors.surface-soft-light}`), closing every page the same way Binance's does.
- Numbers render with `tabular-nums` so stat counters and risk scores stay visually aligned in a column.
- Flat color-block cards (`{colors.surface-card-dark}`) with hairline dividers, never gradients or drop shadows.
- Border radius scale: `{rounded.md}` (6px) for buttons, `{rounded.lg}` (8px) for inputs, `{rounded.xl}` (12px) for card containers.
- Major bands sit at `{spacing.section}` (80px) vertical rhythm.

## Colors

### Brand & Accent
- **CipherWatch Yellow** (`{colors.primary}` — #FCD535): primary CTA backgrounds, the wordmark accent, the "ZERO CONTENT. EVER." headline, stat-callout numbers, review-action buttons.
- **Yellow Active** (`{colors.primary-active}` — #f0b90b): press state for primary buttons.
- **Yellow Disabled** (`{colors.primary-disabled}` — #3a3a1f): disabled CTA state on dark canvas.

### Surface
- **Canvas Dark** (`{colors.canvas-dark}` — #0b0e11): the page floor everywhere except the footer.
- **Surface Card Dark** (`{colors.surface-card-dark}` — #1e2329): alert feed card, session graph card, trust badges, nav dropdowns, CTA band.
- **Surface Elevated Dark** (`{colors.surface-elevated-dark}` — #2b3139): pattern-icon chips inside alert rows, nested cards.
- **Surface Soft Light** (`{colors.surface-soft-light}` — #fafafa): footer only.

### Hairlines & Text
- **Hairline on Dark** (`{colors.hairline-on-dark}` — #2b3139): dividers between alert rows, nav border, FAQ rows.
- **Body** (`{colors.body}` — #eaecef): default running text on dark canvas.
- **Muted** (`{colors.muted}` — #707a8a): footer links, session descriptions.
- **Muted Strong** (`{colors.muted-strong}` — #929aa5): stat labels, badge captions.
- **On Primary** (`{colors.on-primary}` — #181a20): black text on yellow buttons — never invert this.

### Risk Semantics
- **Risk Contained** (`{colors.risk-contained}` — #0ecb81): resolved/low-risk sessions. Text color only, never a card fill.
- **Risk Escalating** (`{colors.risk-escalating}` — #f6465d): critical/elevated sessions. Same usage rule.

## Typography

Runs **Inter** across every role — display, body, and numeric — since CipherWatch doesn't carry a licensed custom typeface the way Binance does. Numeric contexts (stat callouts, risk scores) apply `tabular-nums` to keep columns aligned, which stands in for what BinancePlex did architecturally in the source system.

- `{typography.hero-display}` (64px/700): the "See the exfiltration. Never the content." headline only.
- `{typography.display-lg}` (48px/700): the zero-content band headline.
- `{typography.display-sm}` (32px/600): CTA band headline.
- `{typography.title-lg}` / `{typography.title-sm}`: section and FAQ headers.
- `{typography.number-display}` (40px/700, tabular): stat callouts.
- `{typography.number-sm}` (16px/500, tabular): risk score cells.
- `{typography.body-md}` / `{typography.body-sm}`: running text, descriptions.

## Components

**`hero-band-dark`** — Full-width dark band. Eyebrow pill ("METADATA-ONLY · ZERO CONTENT ACCESS") → `{typography.hero-display}` headline → supporting paragraph → search bar → trust-badge row.

**`search-input-on-dark`** — Session/user/endpoint search. Left segment rounded `{rounded.lg}` on the left corners only, joined to a yellow `{component.button-primary-pill}` "Investigate" action on the right.

**`trust-badge`** — Small dark card pairing a bold yellow value (`< 4 min`, `0`, `No.1`) with a muted label below it. Used in a row under the hero.

**`stat-callout-card`** — Flat, transparent-background yellow number + muted label. No card surface — the number alone carries the weight. Used in the endpoint/session/alert stat band and again (smaller, icon-paired) in the zero-content band.

**`alert-feed-card`** — The `markets-table-card` analog. Tab row (Critical / Elevated / Resolved) above a stack of `{component.alert-row}` entries.

**`alert-row`** — Pattern-icon chips on the left (each event in the exfiltration chain), session ID + user + description in the middle, a risk-score cell colored by `{component.risk-contained-cell}` or `{component.risk-escalating-cell}` on the right, and a `{component.button-review}` action.

**`session-graph-card`** — Replaces the source system's lifestyle-photo strip. An inline SVG node graph tracing a session's multi-hop event chain (e.g. `FILE_CREATE → USB_INSERT → NETWORK_CONNECTION`), with the escalating node colored `{colors.risk-escalating}`.

**`zero-content-band`** — The privacy-guarantee analog to "FUNDS ARE SAFU." Centered yellow `{typography.display-lg}` headline ("ZERO CONTENT. EVER.") over three icon-paired `{component.stat-callout-card}` entries (Files Read, Screens Captured, Keystrokes Logged — all fixed at zero).

**`faq-row`** — Accordion row, question in `{typography.title-sm}` with a chevron that rotates on open; answer in `{typography.body-sm}` when expanded.

**`cta-band-dark`** — Pre-footer band, one step elevated (`{colors.surface-card-dark}`), headline left / `{component.button-primary}` right.

**`footer-light`** — The one light surface in the system. Six-column link grid (Product, Detection, Analysts, Resources, Legal, Community) on `{colors.surface-soft-light}`, closing every page the same way regardless of what's above it.

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` for CTAs, the wordmark, review actions, and the zero-content headline — nowhere else.
- Keep risk-score coloring as text only, never as a row or card background fill.
- Use `tabular-nums` on every stat, count, and score so columns of numbers stay aligned.
- Keep the footer as the single light surface in the entire system — it's the visual "close" of every page.

### Don't
- Don't add a second accent color. One yellow, full stop.
- Don't add gradients, glows, or shadows to cards — flat color-block contrast is the whole visual argument.
- Don't invert `{component.button-primary}`'s text color — black on yellow always.
- Don't let risk-escalating red bleed into a "danger = stop" UI pattern (disabled buttons, error states) — it's reserved for risk semantics only, same discipline as the source system's trading red.

## Responsive Behavior

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Nav collapses to hamburger; hero headline drops to ~36px; alert feed and graph card stack to 1-up; footer 6 columns wrap to 2 |
| Tablet | 768–1024px | Nav stays horizontal but tightens; alert feed / graph split narrows but stays 2-up |
| Desktop | 1024–1440px | Full nav; alert feed / graph in 1.6fr / 1fr split as built |
| Wide | > 1440px | Same as desktop with more outer margin; content caps around 1280px |

## Iteration Guide

1. Reference component YAML keys directly when asking AntiGravity for changes (e.g. "restyle `{component.alert-row}`").
2. New pages stay dark-canvas by default — there is no light-mode variant to reach for.
3. Any new numeric display should inherit `{typography.number-display}` or `{typography.number-sm}` and keep `tabular-nums`.
4. Risk color additions (a third state, e.g. "monitoring") should get a genuinely new semantic token, not a tint of existing red/green.
5. Variants (`-active`, `-disabled`) live as separate `components:` entries, not nested state objects.

## Known Gaps

- No licensed custom typeface — Inter stands in for what BinanceNova/BinancePlex did in the source system; a real product would want its own display face.
- Only the homepage/dashboard surface is documented here. Sessions, Analysts, and Docs pages aren't built yet and will need their own component entries once designed.
- Live-data behavior (how the alert feed updates in real time, WebSocket vs. polling) is backend behavior, not covered by this visual spec.
- Analyst feedback interactions (marking CONFIRMED_THREAT / FALSE_POSITIVE from the alert row) aren't wired into any component state yet — currently just the static "Review" action.
