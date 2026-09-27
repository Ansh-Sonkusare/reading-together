# Design

## Subject
Two people reading one book, often at night, leaving each other notes in the margins. The metaphor is a shared paperback **annotated in two inks**. Each partner is an ink colour. Everything they leave (highlights, notes, bookmarks, their place in the book) shows in their ink.

## The one bold thing: the duet ribbon
A book is drawn as a thin horizontal spine line. Each partner's place is a small bookmark ribbon hanging from the line in their ink, with their page underneath ("Alex p.42", "you p.38"). The same component shows progress on the library cover cards, the "continue reading" block, the book header and the timeline. Everything else stays quiet.

## Tokens

| Name | Light | Dark | Use |
|---|---|---|---|
| Paper | `#FBFAFD` | `#17161F` | page background (faint lilac white, not cream) |
| Leaf | `#FFFFFF` | `#201F2B` | raised surfaces: covers, sheets, menus |
| Ink | `#26243A` | `#ECEAF4` | text, primary buttons (aubergine-navy, not black) |
| Pencil | `#6E6A85` | `#A5A1BA` | secondary text |
| Rule | `#E6E3EE` | `#2E2C3D` | borders, the spine line |
| Wash | `#F1EEF8` | `#252336` | quiet fills (selected, hover) |

**Partner inks** (the only saturated colours). Six, and the two partners can never share one: Rose `#D6336C`, Cobalt `#3B5BDB`, Jade `#0CA678`, Amber `#E8890C`, Violet `#7048E8`, Teal `#1098AD`. Highlight fill = ink at 22% opacity; underline and ribbon = full ink.

**Type.** Literata (made for long reading) for book titles, headings and quotes; Onest for the interface. Scale 1.25: 14 / 16 / 20 / 25 / 31 / 39. Headings weight 600, sentence case, no all-caps labels. Quotes from the book are set in Literata italic.

**Shape.** Covers 4px radius, like paper. Sheets and menus 14px. Pills (buttons, chips) fully round. Shadows only on things that float above the page (menus, sheets, toasts): `0 8px 24px rgb(38 36 58 / .12)`.

## Layout

Library (home), left aligned, max width 960:
```
Alex & Sam                                   🔥 3 days together   [Add a book]
─────────────────────────────────────────────────────────────────────────────
┌──────┐  Alice's Adventures in Wonderland           ← continue reading
│cover │  Lewis Carroll
│      │  ────────▼Alex p.42──────▼you p.38────────  ← duet ribbon
└──────┘  [Keep reading]
From Sam  “She smiled at him across the table.”  This reminds me of you
Our shelf
┌────┐ ┌────┐ ┌────┐     cover grid, 2 cols on phone, 4-5 on desktop,
│    │ │    │ │    │     each with a mini duet ribbon under the cover
└────┘ └────┘ └────┘
```
Book: the text owns the screen. A thin top bar (back, title, the duet ribbon, bookmarks, Aa) fades to low contrast while reading and returns on hover or tap. Page controls are large invisible tap zones at the edges plus arrow keys. Marks, bookmarks and notes render in their author's chosen ink.

## Principles
- Colour means a person. Your things default to your ink. Every highlight, note and bookmark can take its own colour (the owner asked for this), picked from the inks minus your partner's, so nothing you make can pass for theirs. The two partners can never share an ink.
- The book is the hero. Chrome is quiet, text is large, nothing moves on its own except the reveal of a partner's mark.
- Copy is warm and plain: "Keep reading", "Sam left you something", no marketing voice.
- Motion: one moment only, a partner's mark inking in when you reach it (a short fill animation). Respect reduced motion.

## Review against generic defaults
- Cream + serif + terracotta (default 1): rejected; Paper is a cool lilac white and the accents are two people's inks, not a brand clay.
- SaaS card kit (default 4): the stat tiles on /together become one sentence line plus the duet ribbon per book, not four identical cards.
- Template chrome (default 5): no eyebrow labels, no middle-dot meta strings in headings, no "→" on buttons.
