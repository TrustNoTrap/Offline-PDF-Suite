import { useState, useEffect } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { performOCR, validateImage, PDFError } from '@/lib/pdf-tools';
import { toast } from 'sonner';
import { Search, Loader2, Copy, FileText, AlertCircle, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { Progress } from '@/components/ui/progress';

export function PDFOCR() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setImageUrls(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const handleFilesAdded = (newFiles: File[]) => {
    setError(null);
    setResult(null);
    try {
      newFiles.forEach(validateImage);
      setFiles(prev => [...prev, ...newFiles]);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Invalid image file.";
      setError(message);
      toast.error(message);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedIndex >= files.length - 1) {
      setSelectedIndex(Math.max(0, files.length - 2));
    }
    setResult(null);
  };

  const handleOCR = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      let fullText = '';
      for (let i = 0; i < files.length; i++) {
        const text = await performOCR(files[i], (p) => {
          const overallProgress = ((i + p) / files.length) * 100;
          setProgress(overallProgress);
        });
        if (files.length > 1) {
          fullText += `--- ${files[i].name} ---\n\n`;
        }
        fullText += `${text}\n\n`;
      }
      setResult(fullText.trim());
      toast.success("OCR completed successfully!");
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "OCR processing failed.";
      setError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      toast.success("Text copied to clipboard!");
    }
  };

  const handleDownload = () => {
    if (result) {
      const blob = new Blob([result], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ocr_result_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
            <Search className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">OCR Text Recognition</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Extract searchable text from images or scanned documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <Dropzone 
          onFilesAdded={handleFilesAdded} 
          files={files}
          onRemoveFile={handleRemoveFile}
          accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
        />

        {imageUrls.length > 0 && (
          <div className="space-y-4 p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <h3 className="text-sm font-bold text-muted-foreground">Image Preview</h3>
                {files.length > 1 && (
                  <div className="flex items-center space-x-2 bg-white dark:bg-white/5 rounded-xl border p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-lg"
                      disabled={selectedIndex === 0}
                      onClick={() => setSelectedIndex(s => s - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-bold w-16 text-center">
                      {selectedIndex + 1} of {files.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-lg"
                      disabled={selectedIndex === files.length - 1}
                      onClick={() => setSelectedIndex(s => s + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="w-8 h-8 rounded-lg"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="w-8 h-8 rounded-lg"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="relative w-full h-[300px] overflow-auto rounded-xl border bg-black/5 dark:bg-white/5">
              <div className="min-w-full min-h-full flex items-center justify-center p-4">
                <img 
                  src={imageUrls[selectedIndex]} 
                  alt={`Preview ${selectedIndex + 1}`} 
                  className="max-w-none transition-transform duration-200 ease-out origin-center"
                  style={{ transform: `scale(${zoom})` }}
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-bold">
              <span>Recognizing text...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
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

        <div className="flex justify-end">
          <Button 
            size="lg" 
            onClick={handleOCR} 
            disabled={files.length === 0 || isProcessing}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl shadow-lg shadow-primary/20"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing OCR...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Extract Text {files.length > 1 ? `(${files.length} files)` : ''}
              </>
            )}
          </Button>
        </div>

        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>Extracted Text</span>
              </h3>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="rounded-xl font-bold">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="rounded-xl font-bold">
                  <Download className="w-4 h-4 mr-2" />
                  Download .txt
                </Button>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-muted/50 border border-muted-foreground/10 font-mono text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed">
              {result}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
