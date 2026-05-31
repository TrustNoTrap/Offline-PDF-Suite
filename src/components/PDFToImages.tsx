import { useState, useCallback } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileImage, Loader2, Download, AlertCircle, Images } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { validatePDF, PDFError } from '@/lib/pdf-tools';
import { pdfWorkerUrl } from '@/lib/pdf-thumbnails';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type Format = 'png' | 'jpeg';

interface RenderedPage {
  pageNum: number;
  dataUrl: string;
}

const SCALE_OPTIONS = [
  { label: '1×', value: 1 },
  { label: '1.5×', value: 1.5 },
  { label: '2×', value: 2 },
  { label: '3×', value: 3 },
];

export function PDFToImages() {
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState(1.5);
  const [format, setFormat] = useState<Format>('png');
  const [quality, setQuality] = useState(0.9);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [renderedPages, setRenderedPages] = useState<RenderedPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesAdded = async (newFiles: File[]) => {
    setError(null);
    setRenderedPages(null);
    try {
      await validatePDF(newFiles[0]);
      setFile(newFiles[0]);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : 'Invalid PDF file.';
      setError(message);
      toast.error(message);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setRenderedPages(null);
    setError(null);
  };

  const handleExport = useCallback(async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setRenderedPages(null);
    setProgress(0);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const pages: RenderedPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport } as any).promise;

        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const dataUrl = format === 'jpeg'
          ? canvas.toDataURL('image/jpeg', quality)
          : canvas.toDataURL('image/png');

        pages.push({ pageNum: i, dataUrl });
        setProgress(Math.round((i / numPages) * 100));
      }

      setRenderedPages(pages);
      toast.success(`Exported ${numPages} page${numPages > 1 ? 's' : ''} successfully!`);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : 'Failed to export PDF pages.';
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [file, scale, format, quality]);

  const downloadPage = (page: RenderedPage) => {
    const baseName = file?.name.replace(/\.pdf$/i, '') ?? 'document';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const link = document.createElement('a');
    link.href = page.dataUrl;
    link.download = `${baseName}_page_${page.pageNum}.${ext}`;
    link.click();
  };

  const handleDownloadAll = async () => {
    if (!renderedPages) return;
    const baseName = file?.name.replace(/\.pdf$/i, '') ?? 'document';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    for (let i = 0; i < renderedPages.length; i++) {
      const link = document.createElement('a');
      link.href = renderedPages[i].dataUrl;
      link.download = `${baseName}_page_${renderedPages[i].pageNum}.${ext}`;
      link.click();
      // Brief pause between downloads to avoid browser blocking
      await new Promise((r) => setTimeout(r, 150));
    }
    toast.success(`Downloading ${renderedPages.length} images…`);
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500">
            <FileImage className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">PDF to Images</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Export every page of your PDF as a high-quality PNG or JPEG image.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <Dropzone
          onFilesAdded={handleFilesAdded}
          files={file ? [file] : []}
          onRemoveFile={handleRemoveFile}
          accept={{ 'application/pdf': ['.pdf'] }}
          multiple={false}
          maxFiles={1}
        />

        {file && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scale */}
            <div className="p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10 space-y-4">
              <div className="flex items-center space-x-2 text-sm font-bold text-muted-foreground">
                <Images className="w-4 h-4" />
                <span>Output Resolution</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {SCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setScale(opt.value)}
                    className={cn(
                      'flex-1 min-w-[60px] py-3 rounded-xl text-sm font-bold border transition-all',
                      scale === opt.value
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
                        : 'border-muted-foreground/20 text-muted-foreground hover:border-teal-500/30'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Higher scale = larger images, more detail, slower export.
              </p>
            </div>

            {/* Format + quality */}
            <div className="p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10 space-y-4">
              <div className="flex items-center space-x-2 text-sm font-bold text-muted-foreground">
                <FileImage className="w-4 h-4" />
                <span>Format</span>
              </div>
              <div className="flex gap-2">
                {(['png', 'jpeg'] as Format[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={cn(
                      'flex-1 py-3 rounded-xl text-sm font-bold border transition-all uppercase',
                      format === fmt
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
                        : 'border-muted-foreground/20 text-muted-foreground hover:border-teal-500/30'
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {format === 'jpeg' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold">JPEG Quality</Label>
                    <span className="text-sm font-black text-teal-600 dark:text-teal-400">{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={Math.round(quality * 100)}
                    onChange={(e) => setQuality(Number(e.target.value) / 100)}
                    className="w-full h-2 appearance-none rounded-full bg-muted cursor-pointer accent-teal-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">Rendering pages…</span>
                <span className="text-teal-600 dark:text-teal-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <motion.div
                  className="h-2 rounded-full bg-teal-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center space-x-2 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rendered pages grid */}
        <AnimatePresence>
          {renderedPages && renderedPages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-muted-foreground">
                  {renderedPages.length} page{renderedPages.length > 1 ? 's' : ''} ready
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadAll}
                  className="font-bold rounded-xl h-10 px-4"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[480px] overflow-y-auto pr-1">
                {renderedPages.map((page) => (
                  <motion.div
                    key={page.pageNum}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative rounded-xl overflow-hidden border bg-muted/30 cursor-pointer"
                    onClick={() => downloadPage(page)}
                  >
                    <img
                      src={page.dataUrl}
                      alt={`Page ${page.pageNum}`}
                      className="w-full h-auto object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="bg-white/90 dark:bg-black/80 rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs font-bold">
                        <Download className="w-3.5 h-3.5" />
                        Page {page.pageNum}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            onClick={handleExport}
            disabled={!file || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Rendering… {progress}%</>
            ) : (
              <><FileImage className="mr-2 h-5 w-5" />Export to Images</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
