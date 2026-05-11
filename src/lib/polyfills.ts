// Server-side polyfills for Node.js environment
if (typeof global !== 'undefined') {
  // Polyfill for DOMMatrix which is required by some PDF parsing libraries in Node.js
  if (!('DOMMatrix' in global)) {
    try {
      // @ts-expect-error - DOMMatrix is not in global scope in Node.js
      global.DOMMatrix = class DOMMatrix {
        constructor() {}
        static fromFloat32Array() { return new DOMMatrix() }
        static fromFloat64Array() { return new DOMMatrix() }
      };
    } catch {}
  }

  // Silence pdfjs-dist warnings by providing dummy canvas APIs
  if (!('ImageData' in global)) {
    try {
      // @ts-expect-error - ImageData is not in global scope in Node.js
      global.ImageData = function() {};
    } catch {}
  }

  if (!('Path2D' in global)) {
    try {
      // @ts-expect-error - Path2D is not in global scope in Node.js
      global.Path2D = function() {};
    } catch {}
  }
}

export {}
