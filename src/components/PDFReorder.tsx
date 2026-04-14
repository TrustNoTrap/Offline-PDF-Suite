import { useState } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { reorderPDFPages, downloadBlob, validatePDF, PDFError, generateFileName } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { toast } from 'sonner';
import { MoveVertical, Loader2, Download, FileText, GripVertical, AlertCircle, ArrowRight, Undo2, Redo2, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PDFDocument } from 'pdf-lib';
import { Reorder, motion, AnimatePresence } from 'motion/react';
import { NamingOptions, NamingMode } from './NamingOptions';
import { cn } from '@/lib/utils';
import { generatePDFThumbnails } from '@/lib/pdf-thumbnails';
import { PDFPreview } from './PDFPreview';

export function PDFReorder() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageIndices, setPageIndices] = useState<number[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [namingMode, setNamingMode] = useState<NamingMode>('both');
  
  // History for undo/redo
  const [history, setHistory] = useState<number[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleFilesAdded = async (newFiles: File[]) => {
    const file = newFiles[0];
    setError(null);
    setPreviewBytes(null);
    setIsLoadingPages(true);
    
    try {
      await validatePDF(file);
      setFiles([file]);
      
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const count = pdf.getPageCount();
      const initialIndices = Array.from({ length: count }, (_, i) => i);
      
      setPageIndices(initialIndices);
      setHistory([initialIndices]);
      setHistoryIndex(0);

      const thumbs = await generatePDFThumbnails(file);
      setThumbnails(thumbs);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to load PDF pages.";
      setError(message);
      toast.error(message);
      setFiles([]);
      setPageIndices([]);
      setThumbnails([]);
      setHistory([]);
      setHistoryIndex(-1);
    } finally {
      setIsLoadingPages(false);
    }
  };

  const handleRemoveFile = () => {
    setFiles([]);
    setPageIndices([]);
    setThumbnails([]);
    setHistory([]);
    setHistoryIndex(-1);
    setPreviewBytes(null);
    setError(null);
  };

  const commitHistory = () => {
    if (historyIndex >= 0) {
      const currentHistory = history[historyIndex];
      if (JSON.stringify(currentHistory) !== JSON.stringify(pageIndices)) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push([...pageIndices]);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setPreviewBytes(null);
      }
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPageIndices(history[newIndex]);
      setPreviewBytes(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPageIndices(history[newIndex]);
      setPreviewBytes(null);
    }
  };

  const handlePreview = async () => {
    if (files.length === 0) return;
    setIsPreviewing(true);
    setError(null);
    try {
      const reorderedBytes = await reorderPDFPages(files[0], pageIndices);
      setPreviewBytes(reorderedBytes);
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to generate preview.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleReorder = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    try {
      const reorderedBytes = previewBytes || await reorderPDFPages(files[0], pageIndices);
      const fileName = generateFileName(namingMode, prefix, `reordered_${files[0].name.replace('.pdf', '')}`);
      
      // Save to history
      const blob = new Blob([reorderedBytes], { type: 'application/pdf' });
      await addToHistory({
        name: fileName,
        type: 'reorder',
        blob,
        size: blob.size
      });

      downloadBlob(reorderedBytes, fileName, "application/pdf");
      toast.success("PDF reordered successfully!");
    } catch (err) {
      const message = err instanceof PDFError ? err.message : "Failed to reorder PDF.";
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
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
            <MoveVertical className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Reorder Pages</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Drag and drop to change the sequence of pages in your PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <Dropzone 
          onFilesAdded={handleFilesAdded} 
          files={files}
          onRemoveFile={handleRemoveFile}
          multiple={false}
          accept={{ 'application/pdf': ['.pdf'] }}
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

        {isLoadingPages && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Analyzing PDF structure...</p>
          </div>
        )}

        {pageIndices.length > 0 && !isLoadingPages && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col justify-center bg-muted/30 p-6 rounded-[2rem] border border-dashed">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">Page Sequence</h3>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 bg-white dark:bg-white/5 rounded-xl border p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        className="w-8 h-8 rounded-lg"
                        title="Undo"
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        className="w-8 h-8 rounded-lg"
                        title="Redo"
                      >
                        <Redo2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="bg-primary/10 text-primary px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                      {pageIndices.length} Pages
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Drag items below to rearrange the document flow. The numbers on the left indicate the new order.</p>
              </div>
              
              <NamingOptions 
                prefix={prefix} 
                onPrefixChange={setPrefix} 
                mode={namingMode}
                onModeChange={setNamingMode}
                placeholder="e.g., final_report"
                originalName={files.length > 0 ? files[0].name : "reordered"}
              />
            </div>
            
            <Reorder.Group 
              axis="y" 
              values={pageIndices} 
              onReorder={setPageIndices}
              className="space-y-3"
            >
              {pageIndices.map((originalIndex, currentPosition) => (
                <Reorder.Item 
                  key={originalIndex} 
                  value={originalIndex}
                  onDragEnd={commitHistory}
                  whileDrag={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
                  className={cn(
                    "flex items-center justify-between p-4 sm:p-5 rounded-[2rem] border bg-white dark:bg-white/5 cursor-grab active:cursor-grabbing group transition-colors",
                    "hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <div className="flex items-center space-x-4 sm:space-x-6">
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">New</span>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-lg sm:text-xl shadow-lg shadow-primary/20">
                        {currentPosition + 1}
                      </div>
                    </div>
                    
                    <div className="h-10 w-px bg-muted-foreground/20 hidden sm:block" />

                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <GripVertical className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      
                      {thumbnails[originalIndex] ? (
                        <div className="w-12 h-16 sm:w-16 sm:h-20 bg-white border shadow-sm rounded-lg overflow-hidden flex-shrink-0">
                          <img src={thumbnails[originalIndex]} alt={`Page ${originalIndex + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-16 sm:w-16 sm:h-20 bg-muted border rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                      )}

                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-base sm:text-lg">Page {originalIndex + 1}</span>
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                          <span className="text-primary font-black text-sm sm:text-base">Pos {currentPosition + 1}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Original index: {originalIndex}</span>
                      </div>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        )}

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
            disabled={files.length === 0 || isPreviewing || isProcessing || isLoadingPages}
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
            onClick={handleReorder} 
            disabled={files.length === 0 || isProcessing || isLoadingPages}
            className="w-full sm:w-auto font-bold h-14 px-8 rounded-2xl shadow-lg shadow-primary/20"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Save & Download
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
