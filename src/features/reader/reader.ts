import { QUOTE_CONTEXT, canonicalText, fromPos, offsetOf, quoteAt, rangeAt, resolveAnchor, toPos, type Locator, type Pos } from './locator';

export type PaintMark = { id: string; locator: Locator; color: string; kind: 'highlight' | 'underline' };

export type ReaderEvents = {
  relocate: (e: { locator: Locator; pos: Pos; pageEndPos: Pos; spine: number }) => void;
  select: (e: { locator: Locator; pos: Pos; text: string; rect: DOMRect }) => void;
  markClick: (e: { id: string; rect: DOMRect }) => void;
  lengthMismatch: (e: { spine: number; expected: number; actual: number }) => void;
  anchorLost: (e: { id: string; spine: number }) => void;
};

export type ReaderHandle = {
  on<K extends keyof ReaderEvents>(k: K, cb: ReaderEvents[K]): () => void;
  paint(marks: PaintMark[]): void;
  goTo(target: Locator | Pos): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
  setFontScale(scale: number): void;
  destroy(): void;
};

const SELECT_SETTLE_MS = 150;

function outerRect(range: Range): DOMRect {
  const r = range.getBoundingClientRect();
  const frame = range.startContainer.ownerDocument?.defaultView?.frameElement?.getBoundingClientRect();
  return new DOMRect(r.x + (frame?.x ?? 0), r.y + (frame?.y ?? 0), r.width, r.height);
}

export async function createReader(container: HTMLElement, file: Blob, opts: { spineLengths: number[] }): Promise<ReaderHandle> {
  const [{ View }, { Overlayer }] = await Promise.all([import('foliate-js/view.js'), import('foliate-js/overlayer.js')]);
  const lengths = opts.spineLengths;
  const listeners: { [K in keyof ReaderEvents]: Set<ReaderEvents[K]> } = {
    relocate: new Set(),
    select: new Set(),
    markClick: new Set(),
    lengthMismatch: new Set(),
    anchorLost: new Set(),
  };
  const emit = <K extends keyof ReaderEvents>(k: K, e: Parameters<ReaderEvents[K]>[0]) => {
    for (const cb of listeners[k]) (cb as (e: Parameters<ReaderEvents[K]>[0]) => void)(e);
  };
  const texts = new Map<number, string>();
  let shown: { index: number; doc: Document } | undefined;
  // ponytail: foliate keys annotations by CFI, so two marks on the identical range draw once (last wins); merge them upstream if that matters.
  let marks = new Map<string, PaintMark>();
  const painted = new Map<string, string>();

  const view = document.createElement('foliate-view') as InstanceType<typeof View>;
  view.style.cssText = 'display:block;width:100%;height:100%';
  container.append(view);
  // foliate sniffs the format from File.name, so a bare Blob needs one.
  await view.open(file instanceof File ? file : new File([file], 'book.epub'));
  view.renderer.setAttribute('flow', 'paginated');

  const posOf = (spine: number, offset: number) => toPos(spine, Math.min(offset, lengths[spine] ?? 0), lengths);
  const locatorOf = (spine: number, range: Range): Locator => {
    const offset = offsetOf(range.startContainer, range.startOffset);
    const exact = range.collapsed ? QUOTE_CONTEXT : range.toString().length;
    return { spine, offset, cfi: view.getCFI(spine, range), quote: quoteAt(texts.get(spine) ?? '', offset, exact) };
  };

  view.addEventListener('load', (e) => {
    const { doc, index } = (e as CustomEvent<{ doc: Document; index: number }>).detail;
    const text = canonicalText(doc);
    texts.set(index, text);
    shown = { index, doc };
    if (text.length !== lengths[index]) emit('lengthMismatch', { spine: index, expected: lengths[index], actual: text.length });
    // Keys pressed after clicking into the book land in the section iframe; let the host page see them.
    doc.addEventListener('keydown', (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k.key })));
    let timer: ReturnType<typeof setTimeout> | undefined;
    doc.addEventListener('selectionchange', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = doc.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const locator = locatorOf(index, range);
        emit('select', { locator, pos: posOf(index, locator.offset), text: range.toString(), rect: outerRect(range) });
      }, SELECT_SETTLE_MS);
    });
  });

  view.renderer.addEventListener('relocate', (e) => {
    const { range, index } = (e as CustomEvent<{ range?: Range; index: number }>).detail;
    if (!range) return;
    const start = range.cloneRange();
    start.collapse(true);
    const locator = locatorOf(index, start);
    const end = Math.max(locator.offset, offsetOf(range.endContainer, range.endOffset) - 1);
    emit('relocate', { locator, pos: posOf(index, locator.offset), pageEndPos: posOf(index, end), spine: index });
  });

  view.addEventListener('draw-annotation', (e) => {
    const { draw, annotation } = (e as CustomEvent<{ draw: (f: typeof Overlayer.highlight, o: { color: string }) => void; annotation: { mark: PaintMark } }>).detail;
    const { id, kind, color } = annotation.mark;
    const base = kind === 'underline' ? Overlayer.underline : Overlayer.highlight;
    draw((rects, o) => {
      const el = base(rects, o);
      el.dataset.markId = id;
      return el;
    }, { color });
  });

  view.addEventListener('show-annotation', (e) => {
    const { value, range } = (e as CustomEvent<{ value: string; range: Range }>).detail;
    for (const [id, v] of painted) if (v === value) emit('markClick', { id, rect: outerRect(range) });
  });

  // The CFI only counts if it still lands on the quoted text; otherwise re-anchor by offset, then by quote.
  const anchorRange = (doc: Document, locator: Locator): Range | null => {
    try {
      const r = view.resolveCFI(locator.cfi);
      const range = r.index === locator.spine ? r.anchor(doc) : null;
      if (range && (!locator.quote || range.toString() === locator.quote.exact)) return range;
    } catch {
      // Falls through: a CFI the engine can't parse is re-anchored like one that missed.
    }
    const hit = resolveAnchor(canonicalText(doc), locator);
    if (!hit) return null;
    const range = rangeAt(doc, hit.offset);
    const end = rangeAt(doc, hit.offset + hit.length);
    range.setEnd(end.startContainer, end.startOffset);
    return range;
  };

  const add = (m: PaintMark) => {
    if (shown?.index !== m.locator.spine) return;
    const range = anchorRange(shown.doc, m.locator);
    if (!range) {
      painted.delete(m.id);
      return emit('anchorLost', { id: m.id, spine: m.locator.spine });
    }
    const value = view.getCFI(m.locator.spine, range);
    painted.set(m.id, value);
    view.addAnnotation({ value, mark: m } as { value: string }).catch(console.error);
  };
  view.addEventListener('create-overlay', (e) => {
    const { index } = (e as CustomEvent<{ index: number }>).detail;
    for (const m of marks.values()) if (m.locator.spine === index) add(m);
  });

  return {
    on(k, cb) {
      listeners[k].add(cb);
      return () => listeners[k].delete(cb);
    },
    paint(next) {
      const old = new Set(painted.values());
      painted.clear();
      marks = new Map(next.map((m) => [m.id, m]));
      for (const m of marks.values()) add(m);
      const keep = new Set(painted.values());
      for (const v of old) if (!keep.has(v)) view.deleteAnnotation({ value: v }).catch(console.error);
    },
    async goTo(target) {
      const { spine, offset } = typeof target === 'number' ? fromPos(target, lengths) : target;
      // A page often starts on inter-block whitespace, which has no layout box to scroll to; anchor on the next visible char.
      const anchor = (doc: Document) => {
        const skip = canonicalText(doc).slice(offset).search(/\S/);
        return rangeAt(doc, skip === -1 ? offset : offset + skip);
      };
      await view.renderer.goTo({ index: spine, anchor });
    },
    next: () => view.next(),
    prev: () => view.prev(),
    setFontScale(scale) {
      view.renderer.setStyles(`html { font-size: ${scale * 100}% !important; }`);
    },
    destroy() {
      for (const set of Object.values(listeners)) set.clear();
      // foliate's close() throws if no section was ever displayed.
      if (shown) view.close();
      view.remove();
    },
  };
}
