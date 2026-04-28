import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createWorker } from 'tesseract.js';

// ============================================================================
// EXTENSIBILITY GUIDE: Adding a new PDF Manipulation Function
// ============================================================================
// To add a new feature (e.g., Watermarking, Compressing, Rotating):
// 1. Export a new async function here.
// 2. Accept `File` or `File[]` as input, plus any options (e.g., rotation angle).
// 3. Use `await file.arrayBuffer()` to get the raw bytes.
// 4. Use `await PDFDocument.load(bytes)` to parse the PDF.
// 5. Perform your manipulations using the `pdf-lib` API (e.g., `page.drawText()`).
// 6. Return `await pdfDoc.save()` as a `Uint8Array`.
// 7. Handle errors by throwing a `PDFError` so the UI can display it nicely.
// ============================================================================

export class PDFError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'PDFError';
  }
}

// Font Cache to avoid re-fetching
let cachedRegularFont: Uint8Array | null = null;
let cachedBoldFont: Uint8Array | null = null;

// Versatile fonts that cover many languages including Hebrew, Arabic, Cyrillic, etc.
// We try multiple CDN sources to ensure reliability.
const REGULAR_FONT_URLS = [
  'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf',
  'https://unpkg.com/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf',
  'https://raw.githubusercontent.com/dejavu-fonts/dejavu-fonts/master/resources/DejaVuSans.ttf'
];

const BOLD_FONT_URLS = [
  'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf',
  'https://unpkg.com/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf',
  'https://raw.githubusercontent.com/dejavu-fonts/dejavu-fonts/master/resources/DejaVuSans-Bold.ttf'
];

async function fetchWithFallback(urls: string[]): Promise<Uint8Array> {
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      console.log(`Attempting to fetch font from: ${url}`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const buffer = await resp.arrayBuffer();
      console.log(`Successfully loaded font from: ${url}`);
      return new Uint8Array(buffer);
    } catch (err) {
      console.warn(`Failed to fetch from ${url}:`, err);
      lastError = err as Error;
    }
  }
  throw lastError || new Error('All font sources failed');
}

async function getUnicodeFonts() {
  try {
    if (!cachedRegularFont) {
      cachedRegularFont = await fetchWithFallback(REGULAR_FONT_URLS);
    }
    if (!cachedBoldFont) {
      try {
        cachedBoldFont = await fetchWithFallback(BOLD_FONT_URLS);
      } catch (err) {
        console.warn('Bold font failed all sources, using regular as fallback');
        cachedBoldFont = cachedRegularFont;
      }
    }
    return { regular: cachedRegularFont, bold: cachedBoldFont };
  } catch (err) {
    console.error('Critical Font Loading Error:', err);
    return null;
  }
}

/**
 * Validates if a file is a valid PDF.
 */
export async function validatePDF(file: File): Promise<void> {
  if (file.type !== 'application/pdf') {
    throw new PDFError('Invalid file type. Please upload a PDF document.', 'INVALID_TYPE');
  }
  
  try {
    const bytes = await file.arrayBuffer();
    await PDFDocument.load(bytes);
  } catch (error) {
    throw new PDFError('The PDF file appears to be corrupted or password-protected.', 'CORRUPTED');
  }
}

/**
 * Validates if a file is a supported image.
 */
export function validateImage(file: File): void {
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!supportedTypes.includes(file.type)) {
    throw new PDFError('Unsupported image format. Please upload JPG or PNG images.', 'INVALID_IMAGE');
  }
}

/**
 * Merges multiple PDF files into one.
 */
export async function mergePDFs(pdfFiles: File[], compress: boolean = false): Promise<Uint8Array> {
  try {
    const mergedPdf = await PDFDocument.create();
    
    for (const file of pdfFiles) {
      const pdfBytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    
    return await mergedPdf.save({ 
      useObjectStreams: compress,
      addDefaultPage: false
    });
  } catch (error) {
    if (error instanceof PDFError) throw error;
    throw new PDFError('Failed to merge PDFs. One or more files might be invalid.', 'MERGE_FAILED');
  }
}

/**
 * Splits a PDF into multiple PDFs based on page ranges.
 */
export async function splitPDF(pdfFile: File, pageIndices: number[]): Promise<Uint8Array> {
  try {
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    
    const pageCount = pdf.getPageCount();
    const invalidPages = pageIndices.filter(i => i < 0 || i >= pageCount);
    
    if (invalidPages.length > 0) {
      throw new PDFError(`Page range out of bounds. This document has ${pageCount} pages.`, 'OUT_OF_BOUNDS');
    }

    const copiedPages = await newPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    
    return await newPdf.save();
  } catch (error) {
    if (error instanceof PDFError) throw error;
    throw new PDFError('Failed to split PDF. Please check the page range.', 'SPLIT_FAILED');
  }
}

/**
 * Reorders pages in a PDF.
 */
export async function reorderPDFPages(pdfFile: File, newOrder: number[]): Promise<Uint8Array> {
  try {
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    
    const copiedPages = await newPdf.copyPages(pdf, newOrder);
    copiedPages.forEach((page) => newPdf.addPage(page));
    
    return await newPdf.save();
  } catch (error) {
    if (error instanceof PDFError) throw error;
    throw new PDFError('Failed to reorder PDF pages.', 'REORDER_FAILED');
  }
}

/**
 * Converts images to a single PDF.
 */
export async function imagesToPDF(imageFiles: File[]): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    
    for (const file of imageFiles) {
      const imageBytes = await file.arrayBuffer();
      let image;
      
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        image = await pdfDoc.embedJpg(imageBytes);
      } else if (file.type === 'image/png') {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        throw new PDFError(`Unsupported image format: ${file.name}`, 'INVALID_IMAGE');
      }
      
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }
    
    return await pdfDoc.save();
  } catch (error) {
    if (error instanceof PDFError) throw error;
    throw new PDFError('Failed to convert images to PDF.', 'CONVERSION_FAILED');
  }
}

// Singleton worker for OCR to ensure assets are loaded on startup and reused
let tesseractWorkerPromise: Promise<any> | null = null;

/**
 * Initializes and returns the Tesseract worker singleton.
 * This ensures the worker script and WASM are loaded once and kept in memory.
 */
async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      // In Tesseract.js 7.0.0 (as seen in node_modules), createWorker is an async 
      // function that returns a pre-initialized worker.
      // Signature: createWorker(langs, oem, options, config)
      const worker = await createWorker('eng', 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/tesseract-core.wasm.js',
        langPath: '/tesseract/lang-data',
        workerBlobURL: false,
        gzip: false, // We use .traineddata files directly
      });
      
      return worker;
    })();
  }
  return tesseractWorkerPromise;
}

// Trigger initialization on module load to ensure "offline at its core"
// if (typeof window !== 'undefined') {
//   getTesseractWorker().catch(console.error);
// }

/**
 * Performs OCR on an image and returns the text.
 */
export async function performOCR(imageFile: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    const worker = await getTesseractWorker();
    
    // Tesseract.js v5+ doesn't easily allow per-job loggers on a singleton worker
    // without re-creating it, but we can use the recognize options or just rely on the singleton.
    
    const { data: { text } } = await worker.recognize(imageFile);
    return text;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new PDFError('OCR processing failed.', 'OCR_FAILED');
  }
}

/**
 * Fills a PDF with form field data and adds custom annotations (text, images/signatures).
 */
export async function fillPDF(
  pdfFile: File, 
  formFields: Record<string, string | boolean>,
  customAnnotations: {
    pageIndex: number;
    type: 'text' | 'signature' | 'check' | 'cross' | 'dot';
    x: number; // 0-1 relative to page width
    y: number; // 0-1 relative to page height
    content?: string;
    imageUrl?: string;
    width?: number; // 0-1 relative to page width
    height?: number; // 0-1 relative to page height
    color?: string; // Hex color
    fontWeight?: 'normal' | 'bold';
  }[]
): Promise<Uint8Array> {
  try {
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);
    
    const unicodeFonts = await getUnicodeFonts();
    let regularFont: any;
    let boldFont: any;

    if (unicodeFonts) {
      regularFont = await pdfDoc.embedFont(unicodeFonts.regular, { subset: true });
      boldFont = await pdfDoc.embedFont(unicodeFonts.bold || unicodeFonts.regular, { subset: true });
    } else {
      // If font loading failed, we MUST inform the user rather than falling back to WinAnsi which will crash on Unicode
      throw new PDFError('Required Unicode fonts could not be loaded. Please check your internet connection and ensure your language is supported.', 'FONT_LOAD_FAILED');
    }

    const form = pdfDoc.getForm();

    // Helper to parse hex color to pdf-lib rgb
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return rgb(r, g, b);
    };

    // 1. Fill AcroForms
    for (const [name, value] of Object.entries(formFields)) {
      try {
        const field = form.getField(name);
        if (typeof value === 'string') {
          if (field.constructor.name === 'PDFTextField') {
            form.getTextField(name).setText(value);
          } else if (field.constructor.name === 'PDFDropdown') {
            form.getDropdown(name).select(value);
          }
        } else if (typeof value === 'boolean') {
          if (field.constructor.name === 'PDFCheckBox') {
            const cb = form.getCheckBox(name);
            if (value) cb.check(); else cb.uncheck();
          } else if (field.constructor.name === 'PDFRadioGroup') {
            // Radio groups are more complex, but often the value string matches an option
          }
        }
      } catch (err) {
        console.warn(`Field ${name} could not be filled:`, err);
      }
    }

    // Set the font for all form fields to handle Unicode characters.
    try {
      form.updateFieldAppearances(regularFont);
    } catch (err) {
      console.warn('Failed to update form field appearances:', err);
    }

    // 2. Add Custom Annotations (like Acrobat\'s "Fill & Sign")
    for (const ann of customAnnotations) {
      const page = pdfDoc.getPage(ann.pageIndex);
      const { width, height } = page.getSize();

      const centerX = ann.x * width;
      const centerY = (1 - ann.y) * height;

      if (ann.type === 'text' && ann.content) {
        // Map width (fraction or font-scale) to font size
        const fontSize = (ann.width || 0.03) * width;
        const lines = ann.content.split('\n');
        
        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        const currentFont = ann.fontWeight === 'normal' ? regularFont : boldFont;
        
        lines.forEach((line, i) => {
          let textWidth = 0;
          try {
            textWidth = currentFont.widthOfTextAtSize(line, fontSize);
          } catch {
            textWidth = (line.length * fontSize) * 0.5; // fallback approximation
          }
          
          const lineY = centerY + (totalHeight / 2) - (0.95 * fontSize) - (i * lineHeight);
          
          page.drawText(line, {
            x: centerX - textWidth / 2,
            y: lineY,
            size: fontSize,
            font: currentFont,
            color: ann.color ? hexToRgb(ann.color) : rgb(0, 0, 0),
          });
        });
      } else if (ann.type === 'check') {
        const size = (ann.width || 0.05) * width;
        // Use a standard 'V' or similar if the emoji is missing, but FreeSans should have it.
        const text = '✓';
        const textWidth = regularFont.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: centerX - textWidth / 2,
          y: centerY - size * 0.35,
          size: size,
          font: regularFont,
          color: ann.color ? hexToRgb(ann.color) : rgb(0, 0, 0),
        });
      } else if (ann.type === 'cross') {
        const size = (ann.width || 0.05) * width;
        const text = '✕';
        const textWidth = regularFont.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: centerX - textWidth / 2,
          y: centerY - size * 0.35,
          size: size,
          font: regularFont,
          color: ann.color ? hexToRgb(ann.color) : rgb(0, 0, 0),
        });
      } else if (ann.type === 'dot') {
        const size = (ann.width || 0.02) * width;
        page.drawCircle({
          x: centerX,
          y: centerY,
          size: size / 2,
          color: ann.color ? hexToRgb(ann.color) : rgb(0, 0, 0),
        });
      } else if (ann.type === 'signature' && ann.imageUrl) {
        // Signatures are images (PNG/JPG)
        const imageBytes = await (await fetch(ann.imageUrl)).arrayBuffer();
        let image;
        if (ann.imageUrl.includes('image/png') || ann.imageUrl.endsWith('.png')) {
          image = await pdfDoc.embedPng(imageBytes);
        } else {
          image = await pdfDoc.embedJpg(imageBytes);
        }

        const imgWidth = (ann.width || 0.2) * width;
        const imgHeight = (ann.height || (imgWidth / image.width) * image.height);

        page.drawImage(image, {
          x: centerX - imgWidth / 2,
          y: centerY - imgHeight / 2,
          width: imgWidth,
          height: imgHeight,
        });
      }
    }

    return await pdfDoc.save();
  } catch (error: any) {
    if (error instanceof PDFError) throw error;
    throw new PDFError('Failed to fill the PDF document: ' + (error?.message || 'Unknown error'), 'FILL_FAILED');
  }
}

/**
 * Helper to download a Uint8Array as a file.
 */
export function downloadBlob(data: Uint8Array | Blob, fileName: string, mimeType: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Generates a file name based on naming mode and prefix.
 */
export function generateFileName(mode: 'timestamp' | 'prefix' | 'both' | 'original' | 'prefix_original', prefix: string, defaultName: string): string {
  const timestamp = Date.now();
  const base = defaultName.replace(/\.pdf$/i, '');
  const prefixBase = prefix || 'result';
  switch (mode) {
    case 'timestamp': return `${base}_${timestamp}.pdf`;
    case 'prefix': return `${prefixBase}.pdf`;
    case 'both': return `${prefixBase}_${timestamp}.pdf`;
    case 'original': return `${base}.pdf`;
    case 'prefix_original': return `${prefixBase}_${base}.pdf`;
    default: return `${base}_${timestamp}.pdf`;
  }
}
