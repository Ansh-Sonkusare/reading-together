# Competitor and tech research (2026-09-27)

Collected by a research subagent. The URLs are the sources; check any claim against them before relying on it.

## Landscape

| Product | Shared-reading features | Spoiler handling | Book source | Gap we can exploit |
|---|---|---|---|---|
| [Fable](https://fable.co/club-features) | Club progress bars, chapter rooms | "May contain spoilers" toggle, chapter-locked threads | BYO copy | No 1:1 mode; no highlight layer |
| [StoryGraph Buddy Reads](https://roadmap.thestorygraph.com/requests-ideas/posts/buddy-reads) | 2-person progress, comments tagged to page/% | Comments locked until your progress passes them (closest analog) | BYO copy | No in-app reader; [edition page mismatch breaks the lock](https://roadmap.thestorygraph.com/bugs/posts/buddy-read-comment-page-numbers-changing) |
| [Literal.club](https://literal.club/) | Friends, live progress, shared highlights | None | Logs books read elsewhere | Not a reading environment |
| Kindle | Popular Highlights, public notes | None | Store only, DRM | Closed, no pairing |
| Apple Books | Family Sharing of purchases | n/a | Store only, FairPlay | Nothing social |
| Readwise Reader / [Hypothes.is](https://hypothes.is/) | Threaded collaborative annotation (Hypothes.is) | None | Import | Best annotation/thread UX to copy |
| Goodreads | Status feed | Spoiler tags on reviews only, not progress | Links out | Shows what goes wrong without a spoiler gate |
| [Bookclubs.com](https://bookclubs.com/) | Scheduling, polls, discussion guides | None | BYO | Logistics only |
| [Tome](https://apps.apple.com/us/app/tome-read-together/id6762325275) (self-hosted, AGPL) | Share toggles, pace comparison, chapter-gated discussion | Chapter gate | BYO EPUB + Gutenberg | Nearly our concept, but DIY and not couple-specific; the niche is real and open |
| Bookship | Built-in reader with shared inline notes | Weak | BYO | Validates reader + social in one app |

## Book sourcing
Kindle, FairPlay and Adobe (library) DRM rule out store books. The legal options are **user-uploaded EPUBs** and **public domain**: Gutendex ([github](https://github.com/garethbjohnson/gutendex)), the Standard Ebooks OPDS 2.0 feed ([feeds](https://standardebooks.org/feeds)) and Open Library metadata ([developers](https://openlibrary.org/developers)).

## Reader tech
- **epub.js**: light, maintained by a single contributor.
- **Readium**: the standards reference, actively maintained, with native mobile toolkits.
- **foliate-js**: modern ES modules with its own annotation and progress modules.
- **React Native**: `@epubjs-react-native` (a WebView) or `react-native-readium` (native).
- **Anchoring**: use a CFI **plus a W3C Text Quote Selector** (exact/prefix/suffix) so a highlight can be found again after reflow ([readium/annotations](https://github.com/readium/annotations), [W3C](https://www.w3.org/TR/wpub-ann/)).

## Sync backends
- **Convex**: reactive queries.
- **Supabase Realtime**: Postgres plus broadcast and presence.
- **Liveblocks**: text-anchored threads, but priced per seat/comment and only an add-on.
- **Firebase**: mobile-first.

## Top lessons
1. Copy StoryGraph's position-gated unlock, but compare normalised positions, never page numbers.
2. Never broadcast progress or status without a spoiler gate (the Goodreads failure).
3. Put the reader and the social layer in one app, not a companion app.
4. Upload first, with a public-domain catalogue for onboarding.
5. Anchor with CFI plus text quote.
