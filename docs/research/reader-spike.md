# Reader engine spike (P03): foliate-js vs epub.js

Date: 2026-09-27. Fixture: `fixtures/alice.epub` (Gutenberg, 15 spine items). Browser: Playwright 1.63 headless Chromium.
Sketch: `spikes/reader/` (throwaway). Keeper: `src/features/reader/locator.ts`.

## Decision

**foliate-js**, pinned to commit `78914ae` (2026-05-01), installed from git.

It hands the reader the spine item parsed as XML (`application/xhtml+xml`), so the text in the iframe is byte-identical to what we compute from the raw EPUB at upload. Its per-annotation draw hook makes per-person colours a one-liner, and its `relocate` event carries the visible `Range`, which is exactly what `progress.pos` needs.

**epub.js** (0.3.93, last release 2022-02-16) loses. With its default settings (`srcdoc`) it parses XHTML as `text/html`, and the HTML parser changes the text: it drops the newline right after `<pre>` and moves whitespace after `</body>` into the body. That breaks the core property in 4 of 15 spine items, and every offset after a `<pre>` in a chapter is off by one against the upload-time length. `method: 'blobUrl'` fixes it (measured below), but the fix is a non-default flag in an engine with no release in 4.5 years, and the bundle is about 1.8× larger.

## The canonical-text rule (both sides must use it)

> A spine item's canonical text is the `data` of every Text node (CDATA sections included) under `<body>`, concatenated in document order, **as an XML parser produces it**, with no other normalisation.

- In the browser this is `doc.body.textContent`, and an offset is `Range(body start → point).toString().length` (`canonicalText`, `offsetOf`).
- At upload (`canonicalTextFromXhtml`, `spineLengthsFromEpub`): line endings are normalised to `\n` (as XML does), comments, PIs and the doctype are dropped, the five XML entities and numeric references are decoded, and CDATA is kept verbatim. Whitespace-only text nodes count.
- Any other named entity (`&nbsp;`) throws. An XML parser resolves those only through a DTD, so we refuse the upload instead of guessing.
- `pos = spine + offset / spineLength[spine]`, where `spine` is the OPF `<itemref>` index, cover and `linear="no"` items included (both engines index the same way).
- The engine **must** render spine items as `application/xhtml+xml`. An engine or config that parses them as HTML violates the rule.

## Measurements

Every passage was selected in the rendered iframe by a scripted DOM selection, converted to `offset` with `offsetOf`, and turned into `pos` with the Node-computed `spine_lengths`. It was then re-resolved at each layout from the CFI recorded at layout 1 (the "via CFI" column). The **page-start offset** is the start of the page the engine actually showed. It differs across layouts, which proves the layouts really paginated differently while `pos` stayed fixed.

Layouts: A = 100% 390×844, B = 160% 390×844, C = 100% 1280×800, D = 160% 1280×800.

### pos equality per engine × passage × layout (Playwright run output)

| engine | passage | spine | offset A/B/C/D | Node offset | pos (all four) | via layout-A CFI | page-start offset A/B/C/D | equal? |
|---|---|---|---|---|---|---|---|---|
| foliate | ch1 start | 2 | 34/34/34/34 | 34 | 2.002944 | 34 | 1/1/1/1 | YES |
| foliate | ch3 mid | 4 | 4839×4 | 4839 | 4.504220 | 4839 | 4760/4527/3876/3246 | YES |
| foliate | ch12 end | 13 | 11603×4 | 11603 | 13.994088 | 11603 | 11107/11232/7046/10115 | YES |
| foliate | ch3 end (after `<pre>`) | 4 | 9563×4 | 9563 | 4.996457 | 9563 | 9078/9164/6977/8187 | YES |
| epub.js default | ch1 start | 2 | 34×4 | 34 | 2.002944 | 34 | 1/1/1/1 | YES |
| epub.js default | ch3 mid | 4 | 4839×4 | 4839 | 4.504220 | 4839 | 3422/4458/4527/3881 | YES |
| epub.js default | ch12 end | 13 | 11603×4 | 11603 | 13.994088 | 11603 | 10472/11175/7998/9528 | YES |
| epub.js default | ch3 end (after `<pre>`) | 4 | 9562×4 | **9563** | 4.996353 | 9562 | 8186/8830/8012/9485 | layout-stable, **≠ Node** |
| epub.js blobUrl | all four | | same as foliate | | same as foliate | | | YES |

The fourth passage is extra. It sits after the `<pre>` poem in chapter 3 and exposes the epub.js HTML-parse drift that the three required passages happen to miss.

Both engines paint two highlights in two colours (`#e11d48`, `#2563eb`) on every row.

### spineLength: Node (`spineLengthsFromEpub`) vs browser (`spineLength(iframe doc)`), all four layouts

| spine | Node | foliate A/B/C/D | epub.js default A/B/C/D | epub.js blobUrl |
|---|---|---|---|---|
| 0 | 24 | 24 ×4 ✔ | **25** ×4 ✘ | 24 ✔ |
| 1 | 1424 | 1424 ✔ | 1424 ✔ | ✔ |
| 2 | 11549 | 11549 ✔ | 11549 ✔ | ✔ |
| 3 | 10968 | 10968 ✔ | **10967** ✘ | ✔ |
| 4 | 9597 | 9597 ✔ | **9596** ✘ | ✔ |
| 5 | 13883 | 13883 ✔ | 13883 ✔ | ✔ |
| 6 | 12025 | 12025 ✔ | 12025 ✔ | ✔ |
| 7 | 13881 | 13881 ✔ | 13881 ✔ | ✔ |
| 8 | 12765 | 12765 ✔ | 12765 ✔ | ✔ |
| 9 | 13716 | 13716 ✔ | 13716 ✔ | ✔ |
| 10 | 12688 | 12688 ✔ | 12688 ✔ | ✔ |
| 11 | 11446 | 11446 ✔ | 11446 ✔ | ✔ |
| 12 | 10432 | 10432 ✔ | 10432 ✔ | ✔ |
| 13 | 11672 | 11672 ✔ | 11672 ✔ | ✔ |
| 14 | 18466 | 18466 ✔ | **18467** ✘ | ✔ |

`spikes/reader/diag.mjs` locates the first differing character for epub.js default: spine 3 at 947 and spine 4 at 6264 (`"\n\n\n     Alice’s R"` vs `"\n\n     Alice’s Ri"`, the newline after `<pre>`), and spine 0 and 14 at their very end (whitespace after `</body>` pulled into the body). foliate is identical on all four. The iframe `contentType` is `text/html` for epub.js default and `application/xhtml+xml` for foliate and for epub.js blobUrl.

### Everything else

| | foliate-js | epub.js |
|---|---|---|
| paint, per-person colour | `view.addAnnotation({ value: cfi, color })`, plus one `draw-annotation` listener: `e.detail.draw(Overlayer.highlight, { color })`. Underline and squiggly drawers are built in. | `rendition.annotations.highlight(cfi, data, cb, className, { fill })`. Works, but highlights accumulate across sections and are queried globally. |
| goTo | `view.goTo(cfi \| index \| href)`, `goToFraction` | `rendition.display(cfi \| index)` |
| relocate | `relocate` event with `{ range, index, fraction, cfi, tocItem }`. The `Range` feeds `offsetOf` directly. | `relocated` with `{ start.cfi, end.cfi }`. It needs `contents.range(cfi)` to get a Range. |
| CFI round-trip | `view.getCFI(index, range)`, `view.resolveCFI(cfi).anchor(doc)`. It produced the identical CFI string to epub.js on every row. | `contents.cfiFromRange`, `contents.range` |
| JS loaded (sum of files, gzip -9) | 173 KB raw / 50 KB gz (unminified ESM: view, paginator, epub, epubcfi, overlayer, progress, text-walker, vendor/zip) | 322 KB raw / 92 KB gz (epub.min.js + jszip.min.js 3.10.2) |
| maintenance | Last upstream commit 2026-05-01. Not published to npm by the author: the `foliate-js@1.0.1` npm package (2025-04-21) is a third-party republish. README: "not stable… expect the API to change". | npm `epubjs@0.3.93`, 2022-02-16. Only alphas since (0.5.0-alpha.3, 2023-09-26). Last repo commit 2026-03-24. |
| licence | MIT | BSD-2-Clause |
| types | none (JS + JSDoc) | bundled `.d.ts` |

## Open risks

1. **foliate-js API churn.** Pin the commit (`github:johnfactotum/foliate-js#78914ae…`) and wrap it behind `ReaderHandle`, so only one file touches it. Don't use the third-party npm republish.
2. **Engine DOM mutation.** The property holds only while the engine leaves `<body>` text alone. Guard it at runtime: on each `load`, compare `spineLength(doc)` with `book.spine_lengths[index]`, and on mismatch report it and fall back to quote re-anchoring (P22).
3. **One fixture.** Only alice.epub was measured. EPUBs with HTML named entities (`&nbsp;`), non-UTF-8 encodings or zip64 will make `spineLengthsFromEpub` throw (each is marked `ponytail:` in the code). The upload should surface that error rather than store wrong lengths. Test a second, messier EPUB in P12.
4. **foliate `progress.js` fractions are byte-size based**, not our `pos`. Use them only for UI, never for the gate.
5. **Where `spine_lengths` is computed.** `spineLengthsFromEpub` uses only `DecompressionStream` and `TextDecoder`, so it runs unchanged in Node ≥ 18 and in the browser. The upload flow (P12) can compute it client-side or in an Edge/Node function without adding a dependency. A client-computed value is trusted input, so the server should recompute it or verify it if the spoiler gate must resist a hostile uploader.
