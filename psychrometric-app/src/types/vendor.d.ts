declare module 'canvas2svg' {
  class Canvas2SvgContext {
    constructor(width: number, height: number);
    getSerializedSvg(): string;
  }

  export default Canvas2SvgContext;
}

declare module 'svg2pdf.js';

declare module 'jspdf' {
  interface jsPDF {
    svg(
      element: SVGElement,
      options?: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      }
    ): Promise<void>;
  }
}
