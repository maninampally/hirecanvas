import mammoth from 'mammoth';

/**
 * Robust text extraction using pdfjs-dist (Mozilla)
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // We use a dynamic import to avoid issues with top-level await and SSR
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    const data = new Uint8Array(buffer);
    const pdfModule = pdfjs as Record<string, unknown>;
    const getDocument = pdfModule.getDocument as (opts: Record<string, unknown>) => { promise: Promise<unknown> };
    const loadingTask = getDocument({ 
      data,
      disableWorker: true,
      verbosity: 0
    });
    const pdf = await loadingTask.promise as { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str: string }> }> }> };
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: { str: string }) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
  } catch (err) {
    console.error('[Parser] PDF.js extraction failed:', err);
    throw err;
  }
}

export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  const type = mimeType.toLowerCase();

  if (type === 'application/pdf') {
    try {
      const text = await extractTextFromPDF(buffer);
      if (text.length > 10) return text;
    } catch {
      console.warn('[Parser] PDF extraction failed, attempting fallback.');
    }

    // Heuristic fallback (Last resort for protected or weird PDFs)
    const content = buffer.toString('binary');
    const matches = content.match(/\((.*?)\)\s*Tj/g) || [];
    const text = matches
      .map(m => m.replace(/^\(|\)Tj$/g, ''))
      .join(' ')
      .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
      .replace(/\\/g, '');
      
    if (text.length > 20) return text;
    
    return "The PDF content could not be extracted. It might be an image-based scan. Please try a DOCX version.";
  }

  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/msword'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch {
      return "Failed to extract Word document text.";
    }
  }

  return buffer.toString('utf-8');
}
