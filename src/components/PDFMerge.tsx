import { useState } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { mergePDFs, downloadBlob, validatePDF, PDFError, generateFileName } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { toast } from 'sonner';
import { FileStack, Loader2, Download, AlertCircle, Zap, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { NamingOptions, NamingMode } from './NamingOptions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PDFPreview } from './PDFPreview';

export function PDFMerge() {
  // ============================================================================
  // EXTENSIBILITY GUIDE: Standard Tool Component Structure
  // ============================================================================
  // 1. State Management: Track files, processing status, previews, and tool options.
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Tool-specific options
  const [prefix, setPrefix] = useState('');
  const [namingMode, setNamingMode] = useState<NamingMode>('both');
  const [compress, setCompress] = useState(false);

  // 2. File Handling: Validate files before adding them to state.
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

  const handlePreview = async () => {
    if (files.length < 2) return;
    setIsPreviewing(true);
    setError(null);
    try {
      const mergedBytes = await mergePDFs(files, compress);
      setPreviewBytes(mergedBytes);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to generate preview.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  // 3. Processing: Call the core logic function from `src/lib/pdf-tools.ts`.
  const handleMerge = async () => {
    if (files.length < 2) {
      toast.error("Please add at least 2 PDF files to merge.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      // Use cached preview if available, otherwise process
      const mergedBytes = previewBytes || await mergePDFs(files, compress);
      const baseName = files.length > 0 ? files[0].name : 'merged';
      const fileName = generateFileName(namingMode, prefix, baseName);
      
      // 4. History & Download: Save the result to IndexedDB and trigger browser download.
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      await addToHistory({
        name: fileName,
        type: 'merge',
        blob,
        size: blob.size
      });

      downloadBlob(mergedBytes, fileName, "application/pdf");
      toast.success("PDFs merged successfully!");
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to merge PDFs.";
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
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <FileStack className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Merge PDFs</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Combine multiple PDF files into a single document.
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
          <NamingOptions 
            prefix={prefix} 
            onPrefixChange={setPrefix} 
            mode={namingMode}
            onModeChange={setNamingMode}
            originalName={files.length > 0 ? files[0].name : "merged"}
          />
          
          <div className="p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="compress" className="text-sm font-bold flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span>Basic Compression</span>
                </Label>
                <p className="text-xs text-muted-foreground font-medium">
                  Optimize PDF structure to reduce file size.
                </p>
              </div>
              <Switch 
                id="compress" 
                checked={compress} 
                onCheckedChange={(c) => { setCompress(c); setPreviewBytes(null); }}
              />
            </div>
          </div>
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
            disabled={files.length < 2 || isPreviewing || isProcessing}
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
                Preview
              </>
            )}
          </Button>
          <Button 
            size="lg" 
            onClick={handleMerge} 
            disabled={files.length < 2 || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl shadow-lg shadow-primary/20"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Merge & Download
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
