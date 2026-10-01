---
name: VR Tracker
description: A clear equipment issue and return register for VR loans.
colors:
  primary: "#2e2f70"
  primary-deep: "#23245a"
  primary-wash: "#e9eaf5"
  paper: "#fbfaf6"
  paper-deep: "#f3f2ec"
  ink: "#202a25"
  ink-soft: "#667169"
  line: "#d9ddd5"
  pending-wash: "#fff4d6"
  pending-ink: "#78590e"
  borrowed-wash: "#f9e7e4"
  borrowed-ink: "#913d34"
  ready-wash: "#e9f0e9"
  ready-ink: "#315f49"
  damaged-wash: "#e8e9e6"
  focus: "#7779b3"
typography:
  body:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Thonburi, Tahoma, system-ui, sans-serif"
    lineHeight: 1.6
  page-heading:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Thonburi, Tahoma, system-ui, sans-serif"
    fontSize: "clamp(26px, 3vw, 34px)"
    fontWeight: 720
    lineHeight: 1.35
  label:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Thonburi, Tahoma, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
rounded:
  square: "0px"
spacing:
  compact: "8px"
  control: "12px"
  section: "16px"
  surface: "26px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#fffefa"
    rounded: "{rounded.square}"
    padding: "12px 18px"
  input:
    backgroundColor: "#fffefa"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    height: "46px"
---

# Design System: VR Tracker

## Overview

**Creative North Star: "The Equipment Issue Register"**

VR Tracker presents equipment custody as a well-kept issue and return register. Warm paper surfaces, dark readable ink, ruled divisions, aligned identifiers and times, and restrained indigo actions make the current state and next hand-off easy to find. Thai-capable sans serif type supports both the student borrowing path and the administrator's denser inventory work.

The visual language stays functional: pending requests sit alongside the borrower, device, and request time; inventory exposes device identity and status; return starts with a QR scan. The product identity is VR Tracker alone, without institutional naming or marks.

**Key Characteristics:**
- Warm paper and dark ink form the working canvas.
- Indigo identifies navigation, links, focus, and primary actions.
- Equipment and loan states retain distinct semantic colors and written labels.
- Square corners and fine rules keep the register orderly.

## Colors

The palette pairs warm, low-contrast paper neutrals with a single indigo interface accent and restrained status colors.

### Primary
- **Register Indigo** (`{colors.primary}`): Navigation, links, focus accents, and primary actions.
- **Deep Register Indigo** (`{colors.primary-deep}`): Stronger brand text and interaction hover states.
- **Indigo Wash** (`{colors.primary-wash}`): Quiet backing for brand marks and selected interface details.

### Neutral
- **Warm Paper** (`{colors.paper}`): Main surfaces, header, and form areas.
- **Paper Background** (`{colors.paper-deep}`): Page canvas behind surfaces.
- **Register Ink** (`{colors.ink}`): Primary text.
- **Soft Ink** (`{colors.ink-soft}`): Supporting text and metadata.
- **Rule Gray** (`{colors.line}`): Surface outlines and row divisions.

### Named Rules
**The State Text Rule.** Keep each status written beside its color treatment so color is never the only status cue.

## Typography

**Display Font:** Noto Sans Thai (with Leelawadee UI, Thonburi, Tahoma, system sans-serif fallbacks)
**Body Font:** Noto Sans Thai (with Leelawadee UI, Thonburi, Tahoma, system sans-serif fallbacks)

**Character:** A practical sans-serif voice keeps Thai labels, device identifiers, and actions legible. Headings use a compact, medium-bold hierarchy rather than a separate display face.

### Hierarchy
- **Page heading** (weight 720, responsive 26–34px, line-height 1.35): The primary title for each page.
- **Section and card titles** (bold, generally 18px): Register sections and request records.
- **Body** (regular, 14px typical, line-height 1.6): Instructions, record details, and supporting copy.
- **Labels and metadata** (650 weight, 11–13px): Navigation, table headings, and secondary record fields.

### Named Rules
**The Ledger Readability Rule.** Keep identifiers and timestamps easy to scan; use tabular numerals where the register renders them.

## Layout

Desktop pages use a centered content frame up to 1320px with 34px side insets and a 76px header. The dashboard prioritizes pending requests and status summaries above device inventory. At widths below 680px, loan-history table headings are replaced by visible field labels and each record becomes a two-column stacked entry, with actions spanning the full row. Navigation becomes a horizontally scrollable strip, content insets reduce to 16px, registration fields become a single column, and summary tiles use two columns. The primary interface accent remains Register Indigo; status colors retain their separate semantic roles.

## Elevation & Depth

The interface is mostly flat. Fine borders, tonal paper differences, and row rules establish grouping; surfaces use only very faint shadows, and dashboard sections and cards explicitly suppress shadows. Focus is shown with a visible outline and a subtle field border/glow change.

## Shapes

The implemented system forces square corners on all elements, overriding component-level rounded utility classes and declarations. Use straight edges for controls, cards, chips, avatars, and surfaces. One CSS detail remains inconsistent in source: the scrollbar thumb specifies a radius, but the global square-corner rule overrides it.

## Components

### Buttons
- **Character:** Compact, high-contrast actions are easy to identify in the register.
- **Shape:** Square corners (0px).
- **Primary:** Indigo fill with near-white text; the reusable `.primary-button` uses 12px 18px padding and a 700 weight.
- **Hover / Focus:** Hover deepens the primary indigo; keyboard focus uses a 3px visible outline with 3px offset.
- **Secondary:** White or transparent fill with a fine border, used for review and utility actions. Approve actions preserve the green semantic treatment.

### Chips
- **Style:** Compact status marks use a pale semantic wash, darker matching text, and concise padding.
- **State:** Pending is yellow, borrowed is red, ready is green, and damaged is gray. Status remains explicit text. Square corners apply even where component classes request pill shapes.

### Cards / Containers
- **Corner Style:** Square (0px).
- **Background:** Warm paper over the slightly darker paper page canvas.
- **Shadow Strategy:** Flat by default; fine outlines and tonal changes define surfaces.
- **Border:** One-pixel neutral rule; pending request areas add a yellow-tinted boundary.
- **Internal Padding:** Common surface padding is 26px desktop, reduced to 19px on narrow screens; dashboard sections use compact 16–20px padding.

### Inputs / Fields
- **Style:** Near-white fill, dark ink, neutral one-pixel border, and 46px minimum height. Square corners are enforced globally.
- **Focus:** Indigo-shifted border and visible 3px focus outline; focused fields also receive a subtle indigo halo.
- **Disabled:** Native disabled state is retained and visually muted by the component styles.

### Navigation
- **Style:** Brand and route links share the header, with compact sans-serif labels and simple line icons.
- **Default / Hover / Active:** Muted ink at rest, indigo on hover, and deep indigo plus a bottom rule for the active route.
- **Narrow screens:** The route strip scrolls horizontally; account details collapse while the sign-out control remains available.

### Equipment Status Summary
Clickable summary tiles filter the inventory. Each tile pairs a written status label with a count, using pending yellow, borrowed red, ready green, and damaged gray; selected and hovered states receive an inset outline.

## Do's and Don'ts

### Do:
- **Do** use Register Indigo for navigation, links, focus, and primary actions.
- **Do** pair every semantic status color with a readable status label.
- **Do** use square corners and fine rules for recurring surfaces and controls.
- **Do** keep device identifiers, borrower names, and event times aligned and scannable.
- **Do** keep the product identity to “VR Tracker.”

### Don't:
- **Don't** add university names, seals, or logos to the product identity.
- **Don't** use color alone to communicate equipment or loan state.
- **Don't** introduce decorative texture, heavy shadows, or rounded surfaces into the register language.
- **Don't** invent due dates, institutional claims, or activity absent from product data.
