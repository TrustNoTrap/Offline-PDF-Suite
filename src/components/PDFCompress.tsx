import { useState } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Minimize2, Loader2, Download, AlertCircle, TrendingDown, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressPDF, downloadBlob, validatePDF, PDFError, generateFileName } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { NamingOptions, NamingMode } from './NamingOptions';
import { formatBytes } from '@/lib/utils';

export function PDFCompress() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ bytes: Uint8Array; originalSize: number; compressedSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [namingMode, setNamingMode] = useState<NamingMode>('original');

  const handleFilesAdded = async (newFiles: File[]) => {
    setError(null);
    setResult(null);
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
    setResult(null);
    setError(null);
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const compressedBytes = await compressPDF(file);
      setResult({ bytes: compressedBytes, originalSize: file.size, compressedSize: compressedBytes.byteLength });
      toast.success('PDF optimized successfully!');
    } catch (err) {
      const message = err instanceof PDFError ? err.message : 'Failed to compress PDF.';
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!result || !file) return;
    const fileName = generateFileName(namingMode, prefix, file.name);
    const blob = new Blob([result.bytes], { type: 'application/pdf' });
    await addToHistory({ name: fileName, type: 'compress', blob, size: blob.size });
    downloadBlob(result.bytes, fileName, 'application/pdf');
    toast.success(`Downloaded ${fileName}`);
  };

  const savings = result ? (1 - result.compressedSize / result.originalSize) * 100 : 0;

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Minimize2 className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Compress PDF</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Reduce PDF file size by optimizing its internal structure. Works best on unoptimized documents.
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

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/20 space-y-4"
            >
              <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold">
                <TrendingDown className="w-5 h-5" />
                <span>Compression Result</span>
              </div>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Original</p>
                  <p className="text-xl font-black">{formatBytes(result.originalSize)}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Compressed</p>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{formatBytes(result.compressedSize)}</p>
                </div>
                <div className="text-center min-w-[80px]">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Saved</p>
                  <p className={`text-xl font-black ${savings > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {savings > 0 ? `-${savings.toFixed(1)}%` : 'No change'}
                  </p>
                </div>
              </div>
              {savings <= 0 && (
                <p className="text-xs text-muted-foreground text-center font-medium">
                  This PDF is already well-optimized. Size may not change significantly.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row justify-end pt-4 gap-4">
          {result && (
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
            onClick={handleCompress}
            disabled={!file || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Optimizing...</>
            ) : (
              <><Minimize2 className="mr-2 h-5 w-5" />Compress PDF</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
