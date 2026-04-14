import { useState } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { imagesToPDF, downloadBlob, validateImage, PDFError, generateFileName } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { toast } from 'sonner';
import { Image as ImageIcon, Loader2, Download, AlertCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { NamingOptions, NamingMode } from './NamingOptions';
import { PDFPreview } from './PDFPreview';

export function ImageToPDF() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [namingMode, setNamingMode] = useState<NamingMode>('both');

  const handleFilesAdded = (newFiles: File[]) => {
    setError(null);
    setPreviewBytes(null);
    try {
      for (const file of newFiles) {
        validateImage(file);
      }
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Invalid image file.";
      setError(message);
      toast.error(message);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewBytes(null);
  };

  const handlePreview = async () => {
    if (files.length === 0) return;
    setIsPreviewing(true);
    setError(null);
    try {
      const pdfBytes = await imagesToPDF(files);
      setPreviewBytes(pdfBytes);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to generate preview.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error("Please add at least one image.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const pdfBytes = previewBytes || await imagesToPDF(files);
      const fileName = generateFileName(namingMode, prefix, 'images');
      
      // Save to history
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      await addToHistory({
        name: fileName,
        type: 'image-to-pdf',
        blob,
        size: blob.size
      });

      downloadBlob(pdfBytes, fileName, "application/pdf");
      toast.success("Images converted to PDF successfully!");
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to convert images.";
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
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <ImageIcon className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Images to PDF</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Convert JPG and PNG images into a PDF document.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <Dropzone 
          onFilesAdded={handleFilesAdded} 
          files={files}
          onRemoveFile={handleRemoveFile}
          accept={{ 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }}
          validator={(file) => {
            const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!supportedTypes.includes(file.type)) {
              return "Only JPG and PNG images are supported.";
            }
            return null;
          }}
        />

        <NamingOptions 
          prefix={prefix} 
          onPrefixChange={setPrefix} 
          mode={namingMode}
          onModeChange={setNamingMode}
          placeholder="e.g., vacation_photos" 
        />
        
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
                Preview
              </>
            )}
          </Button>
          <Button 
            size="lg" 
            onClick={handleConvert} 
            disabled={files.length === 0 || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl shadow-lg shadow-primary/20"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Convert & Download
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
