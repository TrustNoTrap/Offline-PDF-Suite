import { useState } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Layers, Loader2, Download, AlertCircle, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { watermarkPDF, downloadBlob, validatePDF, PDFError, generateFileName, WatermarkOptions } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { NamingOptions, NamingMode } from './NamingOptions';
import { cn } from '@/lib/utils';

const PRESETS = ['CONFIDENTIAL', 'DRAFT', 'COPY', 'VOID', 'SAMPLE', 'APPROVED'];

const ROTATION_OPTIONS = [
  { label: '0°', value: 0 },
  { label: '45°', value: 45 },
  { label: '90°', value: 90 },
];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

type PreviewFile = File | Uint8Array | null;

export function PDFWatermark({ onPreviewChange }: { onPreviewChange?: (file: PreviewFile) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [namingMode, setNamingMode] = useState<NamingMode>('original');

  // Watermark options
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(60);
  const [opacity, setOpacity] = useState(0.25);
  const [color, setColor] = useState('#808080');
  const [rotation, setRotation] = useState(45);

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
    if (!file || !text.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResultBytes(null);
    try {
      const options: WatermarkOptions = {
        text: text.trim(),
        fontSize,
        opacity,
        color: hexToRgb(color),
        rotation,
      };
      const bytes = await watermarkPDF(file, options);
      setResultBytes(bytes);
      onPreviewChange?.(bytes);
      toast.success('Watermark applied successfully!');
    } catch (err) {
      const message = err instanceof PDFError ? err.message : 'Failed to apply watermark.';
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
    await addToHistory({ name: fileName, type: 'watermark', blob, size: blob.size });
    downloadBlob(resultBytes, fileName, 'application/pdf');
    toast.success(`Downloaded ${fileName}`);
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500">
            <Layers className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Watermark PDF</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Overlay a text watermark on every page of your PDF.
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
            {/* Left: text + presets */}
            <div className="p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10 space-y-4">
              <div className="flex items-center space-x-2 text-sm font-bold text-muted-foreground mb-2">
                <Layers className="w-4 h-4" />
                <span>Watermark Text</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setText(preset)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-bold border transition-all',
                      text === preset
                        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30'
                        : 'border-muted-foreground/20 text-muted-foreground hover:border-violet-500/30 hover:text-violet-600'
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="wm-text" className="text-sm font-bold">Custom text</Label>
                <Input
                  id="wm-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. INTERNAL USE ONLY"
                  className="rounded-xl h-12 border-muted-foreground/20 bg-white dark:bg-white/5"
                />
              </div>
            </div>

            {/* Right: style options */}
            <div className="p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10 space-y-5">
              <div className="flex items-center space-x-2 text-sm font-bold text-muted-foreground mb-2">
                <RotateCw className="w-4 h-4" />
                <span>Style Options</span>
              </div>

              {/* Font size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Font Size</Label>
                  <span className="text-sm font-black text-violet-600 dark:text-violet-400">{fontSize}pt</span>
                </div>
                <input
                  type="range"
                  min={24}
                  max={120}
                  step={2}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full bg-muted cursor-pointer accent-violet-500"
                />
              </div>

              {/* Opacity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Opacity</Label>
                  <span className="text-sm font-black text-violet-600 dark:text-violet-400">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="w-full h-2 appearance-none rounded-full bg-muted cursor-pointer accent-violet-500"
                />
              </div>

              {/* Color */}
              <div className="flex items-center justify-between">
                <Label htmlFor="wm-color" className="text-sm font-bold">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="wm-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-muted-foreground/20 cursor-pointer p-0.5 bg-transparent"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{color.toUpperCase()}</span>
                </div>
              </div>

              {/* Rotation */}
              <div className="space-y-2">
                <Label className="text-sm font-bold">Rotation</Label>
                <div className="flex gap-2">
                  {ROTATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRotation(opt.value)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-sm font-bold border transition-all',
                        rotation === opt.value
                          ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30'
                          : 'border-muted-foreground/20 text-muted-foreground hover:border-violet-500/30'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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
            disabled={!file || !text.trim() || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Applying...</>
            ) : (
              <><Layers className="mr-2 h-5 w-5" />Apply Watermark</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
