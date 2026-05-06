// Server-side polyfills for Node.js environment
if (typeof global !== 'undefined') {
  // Polyfill for DOMMatrix which is required by some PDF parsing libraries in Node.js
  if (!('DOMMatrix' in global)) {
    try {
      // @ts-ignore
      global.DOMMatrix = class DOMMatrix {
        constructor() {}
        static fromFloat32Array() { return new DOMMatrix() }
        static fromFloat64Array() { return new DOMMatrix() }
      };
    } catch (e) {}
  }

  // Silence pdfjs-dist warnings by providing dummy canvas APIs
  if (!('ImageData' in global)) {
    try {
      // @ts-ignore
      global.ImageData = function() {};
    } catch (e) {}
  }

  if (!('Path2D' in global)) {
    try {
      // @ts-ignore
      global.Path2D = function() {};
    } catch (e) {}
  }
}

export {}
