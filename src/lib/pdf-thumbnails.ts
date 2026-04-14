import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerRaw from 'pdfjs-dist/build/pdf.worker.min.mjs?raw';

// Create a Blob URL from the raw worker code to avoid network requests to the host
const workerBlob = new Blob([pdfWorkerRaw], { type: 'text/javascript' });
export const pdfWorkerUrl = URL.createObjectURL(workerBlob);

// Set worker source to local blob URL to ensure offline capability
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Generates base64 image thumbnails for each page of a PDF file.
 */
export async function generatePDFThumbnails(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const thumbnails: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.5 }); // Scale down for thumbnail
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    } as any).promise;

    thumbnails.push(canvas.toDataURL('image/jpeg', 0.8));
  }

  return thumbnails;
}

/**
 * Generates a single thumbnail for the first page of a PDF file.
 */
export async function generateFirstPageThumbnail(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.3 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) return null;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    } as any).promise;

    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error("Failed to generate thumbnail", error);
    return null;
  }
}
