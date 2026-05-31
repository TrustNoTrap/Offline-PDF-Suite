import { useState } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ListOrdered, Loader2, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addPageNumbers, downloadBlob, validatePDF, PDFError, generateFileName, PageNumberOptions } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { NamingOptions, NamingMode } from './NamingOptions';
import { cn } from '@/lib/utils';

type Position = PageNumberOptions['position'];
type Format = PageNumberOptions['format'];

const POSITIONS: { label: string; value: Position; row: number; col: number }[] = [
  { label: 'Top Left',      value: 'top-left',      row: 0, col: 0 },
  { label: 'Top Center',    value: 'top-center',    row: 0, col: 1 },
  { label: 'Top Right',     value: 'top-right',     row: 0, col: 2 },
  { label: 'Bottom Left',   value: 'bottom-left',   row: 1, col: 0 },
  { label: 'Bottom Center', value: 'bottom-center', row: 1, col: 1 },
  { label: 'Bottom Right',  value: 'bottom-right',  row: 1, col: 2 },
];

const FORMATS: { label: string; example: string; value: Format }[] = [
  { label: 'Number',       example: '1',           value: 'number' },
  { label: 'X / Y',        example: '1 / 5',       value: 'number-of-total' },
  { label: 'Page X',       example: 'Page 1',      value: 'page-number' },
  { label: 'Page X of Y',  example: 'Page 1 of 5', value: 'page-number-of-total' },
];

type PreviewFile = File | Uint8Array | null;

export function PDFPageNumbers({ onPreviewChange }: { onPreviewChange?: (file: PreviewFile) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [namingMode, setNamingMode] = useState<NamingMode>('original');

  // Page number options
  const [position, setPosition] = useState<Position>('bottom-center');
  const [format, setFormat] = useState<Format>('number-of-total');
  const [startNumber, setStartNumber] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [margin, setMargin] = useState(30);

  const handleFilesAdded = async (newFiles: File[]) => {
    setError(null);
    setResultBytes(null);
    try {
      await validatePDF(newFiles[0]);
      setFile(newFiles[0]);
      onPreviewChange?.(newFiles[0]);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : 'Invalid PDF file.';
      setError(message);
      toast.error(message);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setResultBytes(null);
    setError(null);
    onPreviewChange?.(null);
  };

  const handleApply = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResultBytes(null);
    try {
      const options: PageNumberOptions = { position, format, startNumber, fontSize, margin };
      const bytes = await addPageNumbers(file, options);
      setResultBytes(bytes);
      onPreviewChange?.(bytes);
      toast.success('Page numbers added successfully!');
    } catch (err) {
      const message = err instanceof PDFError ? err.message : 'Failed to add page numbers.';
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!resultBytes || !file) return;
    const fileName = generateFileName(namingMode, prefix, file.name);
    const blob = new Blob([resultBytes], { type: 'application/pdf' });
    await addToHistory({ name: fileName, type: 'page-numbers', blob, size: blob.size });
    downloadBlob(resultBytes, fileName, 'application/pdf');
    toast.success(`Downloaded ${fileName}`);
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <ListOrdered className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Page Numbers</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Add page numbers to every page of your PDF at any position.
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
            {/* Position picker */}
            <div className="p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10 space-y-4">
              <div className="flex items-center space-x-2 text-sm font-bold text-muted-foreground">
                <ListOrdered className="w-4 h-4" />
                <span>Position</span>
              </div>
              {/* 2-row × 3-col grid mimicking page layout */}
              <div className="grid grid-cols-3 grid-rows-2 gap-2">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos.value}
                    onClick={() => setPosition(pos.value)}
                    className={cn(
                      'py-2 px-1 rounded-xl text-xs font-bold border transition-all',
                      position === pos.value
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'border-muted-foreground/20 text-muted-foreground hover:border-amber-500/30'
                    )}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>

              {/* Format */}
              <div className="space-y-2">
                <Label className="text-sm font-bold">Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMATS.map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => setFormat(fmt.value)}
                      className={cn(
                        'py-2 px-2 rounded-xl text-xs border transition-all text-left',
                        format === fmt.value
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'border-muted-foreground/20 text-muted-foreground hover:border-amber-500/30'
                      )}
                    >
                      <span className="block font-bold">{fmt.label}</span>
                      <span className="block text-[10px] opacity-70 font-mono">{fmt.example}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Numeric options */}
            <div className="p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10 space-y-5">
              <div className="flex items-center space-x-2 text-sm font-bold text-muted-foreground mb-2">
                <ListOrdered className="w-4 h-4" />
                <span>Number Options</span>
              </div>

              {/* Start number */}
              <div className="space-y-2">
                <Label htmlFor="start-num" className="text-sm font-bold">Start Number</Label>
                <Input
                  id="start-num"
                  type="number"
                  min={0}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(0, Number(e.target.value)))}
                  className="rounded-xl h-12 border-muted-foreground/20 bg-white dark:bg-white/5 w-full"
                />
              </div>

              {/* Font size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Font Size</Label>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400">{fontSize}pt</span>
                </div>
                <input
                  type="range"
                  min={7}
                  max={24}
                  step={1}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full bg-muted cursor-pointer accent-amber-500"
                />
              </div>

              {/* Margin */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Edge Margin</Label>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400">{margin}pt</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={5}
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full bg-muted cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {file && (
          <NamingOptions
            prefix={prefix}
            onPrefixChange={setPrefix}
            mode={namingMode}
            onModeChange={setNamingMode}
            originalName={file.name}
          />
        )}

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

        <div className="flex flex-col sm:flex-row justify-end pt-4 gap-4">
          {resultBytes && (
            <Button
              size="lg"
              variant="outline"
              onClick={handleDownload}
              className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl"
            >
              <Download className="mr-2 h-5 w-5" />
              Download
            </Button>
          )}
          <Button
            size="lg"
            onClick={handleApply}
            disabled={!file || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Adding…</>
            ) : (
              <><ListOrdered className="mr-2 h-5 w-5" />Add Page Numbers</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
