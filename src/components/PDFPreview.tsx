import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { pdfWorkerUrl } from '@/lib/pdf-thumbnails';
import { Loader2 } from 'lucide-react';

// Ensure worker source is set
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PDFPreviewProps {
  file: Uint8Array | Blob | File;
}

export function PDFPreview({ file }: PDFPreviewProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        let data: Uint8Array | ArrayBuffer;
        if (file instanceof Uint8Array) {
          data = file;
        } else {
          data = await file.arrayBuffer();
        }
        const loadedPdf = await pdfjsLib.getDocument({ data }).promise;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (error) {
        console.error("Error loading PDF preview:", error);
      }
    };
    loadPdf();
  }, [file]);

  if (!pdf) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/20 rounded-xl border">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-bold text-muted-foreground">PDF Preview</h3>
        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">
          {numPages} Pages
        </span>
      </div>
      <div 
        ref={containerRef}
        className="flex flex-col items-center space-y-4 bg-muted/10 p-4 rounded-xl border max-h-[500px] overflow-y-auto"
      >
        {Array.from({ length: numPages }, (_, i) => (
          <PDFPage key={i + 1} pdf={pdf} pageNumber={i + 1} />
        ))}
      </div>
    </div>
  );
}

const PDFPage: React.FC<{ pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number }> = ({ pdf, pageNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || isRendered || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport
        } as any).promise;
        setIsRendered(true);
      } catch (error) {
        console.error("Error rendering page:", error);
      }
    };

    renderPage();
  }, [isVisible, isRendered, pdf, pageNumber]);

  return (
    <div ref={containerRef} className="relative bg-white shadow-sm border rounded-lg overflow-hidden min-h-[300px] w-full flex justify-center">
      {!isRendered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <canvas ref={canvasRef} className="max-w-full h-auto" />
    </div>
  );
}
