// Only the slice of foliate-js@78914ae that reader.ts uses; the package ships no types.
declare module 'foliate-js/view.js' {
  type Anchor = Range | number | ((doc: Document) => Range);
  export class View extends HTMLElement {
    renderer: HTMLElement & {
      goTo(target: { index: number; anchor?: Anchor }): Promise<void>;
      setStyles(css: string): void;
    };
    open(book: Blob): Promise<void>;
    close(): void;
    next(): Promise<void>;
    prev(): Promise<void>;
    getCFI(index: number, range?: Range): string;
    addAnnotation(annotation: { value: string }): Promise<unknown>;
    deleteAnnotation(annotation: { value: string }): Promise<unknown>;
  }
}

declare module 'foliate-js/overlayer.js' {
  type Draw = (rects: DOMRectList, options: { color?: string }) => SVGElement;
  export class Overlayer {
    static highlight: Draw;
    static underline: Draw;
  }
}
