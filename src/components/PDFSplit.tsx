import { useState } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { splitPDF, downloadBlob, validatePDF, PDFError, generateFileName } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { toast } from 'sonner';
import { Scissors, Loader2, Download, AlertCircle, Files, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { NamingOptions, NamingMode } from './NamingOptions';
import { PDFPreview } from './PDFPreview';

export function PDFSplit() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageRange, setPageRange] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [namingMode, setNamingMode] = useState<NamingMode>('both');

  const handleFilesAdded = async (newFiles: File[]) => {
    setError(null);
    setPreviewBytes(null);
    try {
      for (const file of newFiles) {
        await validatePDF(file);
      }
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Invalid PDF file.";
      setError(message);
      toast.error(message);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewBytes(null);
  };

  const parsePageRange = (range: string): number[] => {
    const indices: number[] = [];
    const parts = range.split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            indices.push(i - 1); // 1-indexed to 0-indexed
          }
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num)) {
          indices.push(num - 1);
        }
      }
    }
    return Array.from(new Set(indices)).sort((a, b) => a - b);
  };

  const handlePreview = async () => {
    if (files.length === 0) return;
    if (!pageRange) {
      toast.error("Please enter a page range.");
      return;
    }

    const pageIndices = parsePageRange(pageRange);
    if (pageIndices.length === 0) {
      toast.error("Invalid page range format.");
      return;
    }

    setIsPreviewing(true);
    setError(null);
    try {
      // Preview only the first file
      const splitBytes = await splitPDF(files[0], pageIndices);
      setPreviewBytes(splitBytes);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to generate preview.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSplit = async () => {
    if (files.length === 0) {
      toast.error("Please add at least one PDF file.");
      return;
    }
    if (!pageRange) {
      toast.error("Please enter a page range.");
      return;
    }

    const pageIndices = parsePageRange(pageRange);
    if (pageIndices.length === 0) {
      toast.error("Invalid page range format.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Use previewBytes if it's the first file and we already generated it
        const splitBytes = (i === 0 && previewBytes) ? previewBytes : await splitPDF(file, pageIndices);
        const baseName = `split_${file.name.replace('.pdf', '')}`;
        const fileName = generateFileName(namingMode, prefix, baseName);
        
        // Save to history
        const blob = new Blob([splitBytes], { type: 'application/pdf' });
        await addToHistory({
          name: fileName,
          type: 'split',
          blob,
          size: blob.size
        });

        downloadBlob(splitBytes, fileName, "application/pdf");
      }
      toast.success(`Successfully split ${files.length} file(s)!`);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to split PDF.";
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
            <Scissors className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Split PDFs (Batch)</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Extract specific pages from one or more PDF documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <Dropzone 
          onFilesAdded={handleFilesAdded} 
          files={files}
          onRemoveFile={handleRemoveFile}
          accept={{ 'application/pdf': ['.pdf'] }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10">
            <div className="flex items-center space-x-2 text-sm font-bold text-muted-foreground mb-2">
              <Files className="w-4 h-4" />
              <span>Split Configuration</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="range" className="text-sm font-bold">Page Range</Label>
              <Input
                id="range"
                placeholder="e.g., 1-3, 5, 8-10"
                value={pageRange}
                onChange={(e) => { setPageRange(e.target.value); setPreviewBytes(null); }}
                className="rounded-xl h-12 border-muted-foreground/20 focus:ring-primary bg-white dark:bg-white/5"
              />
              <p className="text-xs text-muted-foreground font-medium">
                Use commas for separate pages and hyphens for ranges.
              </p>
            </div>
          </div>

          <NamingOptions 
            prefix={prefix} 
            onPrefixChange={setPrefix} 
            mode={namingMode}
            onModeChange={setNamingMode}
            placeholder="e.g., chapter_1" 
            originalName={files.length > 0 ? files[0].name : "split"}
          />
        </div>
        
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

        {previewBytes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-4"
          >
            <PDFPreview file={previewBytes} />
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row justify-end pt-4 gap-4">
          <Button 
            variant="outline"
            size="lg" 
            onClick={handlePreview} 
            disabled={files.length === 0 || isPreviewing || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl"
          >
            {isPreviewing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-5 w-5" />
                Preview {files.length > 1 ? '(1st file)' : ''}
              </>
            )}
          </Button>
          <Button 
            size="lg" 
            onClick={handleSplit} 
            disabled={files.length === 0 || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl shadow-lg shadow-primary/20"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Splitting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Split & Download
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
