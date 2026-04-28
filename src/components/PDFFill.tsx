import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  PenTool, 
  Type, 
  Check, 
  X, 
  Circle, 
  Download, 
  Loader2, 
  Trash2, 
  Eraser,
  Signature as SignatureIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Undo,
  Redo,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import { pdfWorkerUrl } from '@/lib/pdf-thumbnails';
import { fillPDF, generateFileName, downloadBlob, PDFError } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// Ensure worker source is set
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type AnnotationType = 'none' | 'text' | 'signature' | 'check' | 'cross' | 'dot';

interface CustomAnnotation {
  id: string;
  pageIndex: number;
  type: Exclude<AnnotationType, 'none'>;
  x: number; // 0-1 relative to page width
  y: number; // 0-1 relative to page height
  content?: string;
  imageUrl?: string;
  width?: number;
  height?: number;
  color?: string; // Hex color
}

const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Green', value: '#008000' },
];

export function PDFFill() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  
  const [selectedTool, setSelectedTool] = useState<AnnotationType>('text');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [annotations, setAnnotations] = useState<CustomAnnotation[]>([]);
  const annotationsRef = useRef<CustomAnnotation[]>([]);
  
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  const [past, setPast] = useState<CustomAnnotation[][]>([]);
  const [future, setFuture] = useState<CustomAnnotation[][]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [tempSignature, setTempSignature] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // Normalized 0-1
  const [isFullscreen, setIsFullscreen] = useState(false);

  // History Management
  const pushToHistory = useCallback((newAnnotations: CustomAnnotation[]) => {
    setPast(prev => [...prev, annotationsRef.current]);
    setFuture([]);
    setAnnotations(newAnnotations);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(prev => [annotationsRef.current, ...prev]);
    setAnnotations(previous);
    setPast(newPast);
    setSelectedAnnotationId(null);
  }, [past]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(prev => [...prev, annotationsRef.current]);
    setAnnotations(next);
    setFuture(newFuture);
    setSelectedAnnotationId(null);
  }, [future]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        // If it's a text annotation input, we might want to allow undo/redo within the input itself
        // But for global undo/redo of annotations, we can still catch it if it's not a standard text move
        // However, for simplicity and to avoid intercepting native input undo, we check focus
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // File Handling
  const handleFilesAdded = async (files: File[]) => {
    if (files.length === 0) return;
    const selectedFile = files[0];
    setFile(selectedFile);
    setAnnotations([]);
    setPast([]);
    setFuture([]);
    setCurrentPage(1);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdf(loadedPdf);
      setNumPages(loadedPdf.numPages);
    } catch (error) {
      toast.error("Failed to load PDF for editing.");
      console.error(error);
    }
  };

  const handleAddAnnotation = (pageIndex: number, x: number, y: number) => {
    if (selectedTool === 'none') return;
    
    if (selectedTool === 'signature') {
      setIsSignatureDialogOpen(true);
      // We'll place the signature after the dialog is confirmed
      return;
    }

    const newAnnotation: CustomAnnotation = {
      id: Math.random().toString(36).substr(2, 9),
      pageIndex,
      type: selectedTool as any,
      x,
      y,
      content: selectedTool === 'text' ? '' : undefined,
      color: selectedColor,
      width: selectedTool === 'text' ? 0.03 : undefined, // Default font size scale
    };

    pushToHistory([...annotations, newAnnotation]);
    if (selectedTool === 'text') {
      setSelectedAnnotationId(newAnnotation.id);
    }
  };

  const handleRemoveAnnotation = (id: string) => {
    pushToHistory(annotations.filter(a => a.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  };

  const handleSignatureConfirm = (signatureDataUrl: string) => {
    // For now, we'll place it in the center of the current page if it was triggered by tool selection
    // Or we could wait for a click. Let's make it so clicking 'Sign' opens dialog, then click on page places it.
    setTempSignature(signatureDataUrl);
    setIsSignatureDialogOpen(false);
    toast.info("Click anywhere on the page to place your signature.");
  };

  const handlePlaceSignature = (pageIndex: number, x: number, y: number) => {
    if (!tempSignature) return;

    const newAnnotation: CustomAnnotation = {
      id: Math.random().toString(36).substr(2, 9),
      pageIndex,
      type: 'signature',
      x,
      y,
      imageUrl: tempSignature,
      width: 0.25, // Default width 25% of page
    };

    pushToHistory([...annotations, newAnnotation]);
    setTempSignature(null);
  };

  const handleSave = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      // Map annotations to the structure fillPDF expects
      const processedAnnotations = annotations.map(a => ({
        pageIndex: a.pageIndex,
        type: a.type === 'signature' ? 'signature' : 'text' as 'text' | 'signature',
        x: a.x,
        y: a.y,
        content: a.type === 'text' ? a.content : (
          a.type === 'check' ? '✓' : (a.type === 'cross' ? '✘' : (a.type === 'dot' ? '●' : ''))
        ),
        imageUrl: a.imageUrl,
        width: a.width,
        height: a.height,
        color: a.color
      }));

      const resultBytes = await fillPDF(file, {}, processedAnnotations);
      const fileName = generateFileName('both', 'filled', file.name);
      
      const blob = new Blob([resultBytes], { type: 'application/pdf' });
      await addToHistory({
        name: fileName,
        type: 'edit',
        blob,
        size: blob.size
      });

      downloadBlob(resultBytes, fileName, 'application/pdf');
      toast.success("PDF saved and downloaded!");
    } catch (error) {
      toast.error("Failed to save PDF changes.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateTextAnnotation = (id: string, content: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, content } : a));
  };

  const commitTextAnnotation = (id: string, content: string) => {
    const current = annotationsRef.current;
    pushToHistory(current.map(a => a.id === id ? { ...a, content } : a));
  };

  const updateAnnotationPositionLive = (id: string, x: number, y: number) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, x, y } : a));
  };

  const updateAnnotationPosition = (id: string, x: number, y: number) => {
    const current = annotationsRef.current;
    pushToHistory(current.map(a => a.id === id ? { ...a, x, y } : a));
    setSelectedAnnotationId(id);
  };

  const updateAnnotationSizeLive = (id: string, width: number, height?: number) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, width, height } : a));
  };

  const updateAnnotationSize = (id: string, width: number, height?: number) => {
    const current = annotationsRef.current;
    pushToHistory(current.map(a => a.id === id ? { ...a, width, height } : a));
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <PenTool className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Fill & Sign</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Add text, checkmarks, and signatures to your PDF document.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        {!file ? (
          <Dropzone 
            onFilesAdded={handleFilesAdded} 
            files={[]}
            accept={{ 'application/pdf': ['.pdf'] }}
          />
        ) : (
          <div className={isFullscreen 
            ? "fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col space-y-4 p-4 md:p-8 h-[100dvh] overflow-hidden" 
            : "flex flex-col space-y-4"}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-[2rem] border border-muted-foreground/10 sticky top-0 z-10 backdrop-blur-md">
              <Button 
                variant={selectedTool === 'text' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setSelectedTool('text')}
                className="rounded-full font-bold"
              >
                <Type className="w-4 h-4 mr-2" />
                Add Text
              </Button>
              <Button 
                variant={selectedTool === 'signature' || tempSignature ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => {
                  if (tempSignature) {
                    setSelectedTool('signature');
                  } else {
                    setSelectedTool('signature');
                    setIsSignatureDialogOpen(true);
                  }
                }}
                className="rounded-full font-bold"
              >
                <SignatureIcon className="w-4 h-4 mr-2" />
                Sign
              </Button>
              <div className="h-8 w-[1px] bg-border mx-1" />
              <Button 
                variant={selectedTool === 'check' ? 'default' : 'outline'} 
                size="icon" 
                onClick={() => setSelectedTool('check')}
                className="rounded-full"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button 
                variant={selectedTool === 'cross' ? 'default' : 'outline'} 
                size="icon" 
                onClick={() => setSelectedTool('cross')}
                className="rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button 
                variant={selectedTool === 'dot' ? 'default' : 'outline'} 
                size="icon" 
                onClick={() => setSelectedTool('dot')}
                className="rounded-full"
              >
                <Circle className="w-4 h-4" />
              </Button>
              <div className="h-8 w-[1px] bg-border mx-1" />
              
              <div className="flex items-center space-x-1.5 px-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      selectedColor === color.value 
                        ? 'border-primary ring-2 ring-primary/20 scale-110' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>

              <div className="h-8 w-[1px] bg-border mx-1" />
              
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => { setSelectedTool('none'); setTempSignature(null); }}
                className="rounded-full"
                title="Clear Tool"
              >
                <Eraser className="w-4 h-4" />
              </Button>

              <div className="h-8 w-[1px] bg-border mx-1" />

              <div className="flex items-center space-x-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={undo} 
                  disabled={past.length === 0}
                  className="rounded-full h-8 w-8"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={redo} 
                  disabled={future.length === 0}
                  className="rounded-full h-8 w-8"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1" />

              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full" 
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>

              <div className="flex items-center space-x-2 bg-background/50 p-1 rounded-full border">
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>

              <Button 
                variant="default" 
                onClick={handleSave} 
                disabled={isProcessing}
                className="rounded-full font-bold shadow-lg shadow-primary/20"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Save PDF
              </Button>
              
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => setFile(null)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center space-x-4">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-bold">Page {currentPage} of {numPages}</span>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
                className="rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* PDF Viewport */}
            <div className={`relative flex justify-center bg-muted/10 p-4 md:p-8 rounded-[2rem] border overflow-auto ${isFullscreen ? 'flex-1 min-h-0' : 'min-h-[600px]'}`}>
              <div 
                className="relative shadow-2xl bg-white dark:bg-zinc-900 border"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
              >
                {pdf && (
                  <PDFPageRenderer 
                    pdf={pdf} 
                    pageNumber={currentPage} 
                    onPageClick={(x, y) => {
                      if (tempSignature) {
                        handlePlaceSignature(currentPage - 1, x, y);
                      } else {
                        handleAddAnnotation(currentPage - 1, x, y);
                      }
                    }}
                    annotations={annotations.filter(a => a.pageIndex === currentPage - 1)}
                    selectedAnnotationId={selectedAnnotationId}
                    onSelectAnnotation={setSelectedAnnotationId}
                    onUpdateAnnotation={updateTextAnnotation}
                    onCommitAnnotation={commitTextAnnotation}
                    onUpdatePosition={updateAnnotationPosition}
                    onUpdatePositionLive={updateAnnotationPositionLive}
                    onUpdateSize={updateAnnotationSize}
                    onUpdateSizeLive={updateAnnotationSizeLive}
                    onRemoveAnnotation={handleRemoveAnnotation}
                    placingSignature={tempSignature}
                  />
                )}
              </div>
            </div>
            
            {/* Contextual Toolbar */}
            <AnimatePresence>
              {(() => {
                const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId);
                if (!selectedAnnotation) return null;
                
                return (
                  <ContextualToolbar 
                    annotation={selectedAnnotation}
                    onUpdateColor={(color) => {
                      pushToHistory(annotations.map(a => a.id === selectedAnnotationId ? { ...a, color } : a));
                    }}
                    onUpdateFontSize={(delta) => {
                      const newAnnotations = annotations.map(a => {
                        if (a.id === selectedAnnotationId) {
                          const currentSize = a.width || 0.03;
                          return { ...a, width: Math.max(0.01, Math.min(0.5, currentSize + delta)) };
                        }
                        return a;
                      });
                      pushToHistory(newAnnotations);
                    }}
                    onDelete={() => handleRemoveAnnotation(selectedAnnotationId!)}
                    onDeselect={() => setSelectedAnnotationId(null)}
                  />
                );
              })()}
            </AnimatePresence>
          </div>
        )}
      </CardContent>

      <SignatureDialog 
        isOpen={isSignatureDialogOpen} 
        onClose={() => setIsSignatureDialogOpen(false)} 
        onConfirm={handleSignatureConfirm} 
      />
    </Card>
  );
}

// Sub-component for rendering a single page with interaction
interface PageRendererProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  onPageClick: (x: number, y: number) => void;
  annotations: CustomAnnotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotation: (id: string, content: string) => void;
  onCommitAnnotation: (id: string, content: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdatePositionLive: (id: string, x: number, y: number) => void;
  onUpdateSize: (id: string, width: number, height?: number) => void;
  onUpdateSizeLive: (id: string, width: number, height?: number) => void;
  onRemoveAnnotation: (id: string) => void;
  placingSignature?: string | null;
}

function PDFPageRenderer({ 
  pdf, 
  pageNumber, 
  onPageClick, 
  annotations, 
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation, 
  onUpdatePosition,
  onUpdatePositionLive,
  onUpdateSize,
  onUpdateSizeLive,
  onRemoveAnnotation,
  onCommitAnnotation,
  placingSignature
}: PageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let isCurrent = true;

    const renderPage = async () => {
      try {
        // 1. If there's a task already running, cancel it and wait for it to settle
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          try {
            await renderTaskRef.current.promise;
          } catch (e) {
            // Ignore intended cancellation errors
          }
        }

        if (!isCurrent) return;

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || !isCurrent) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setDimensions({ width: viewport.width, height: viewport.height });

        const task = page.render({
          canvasContext: context,
          viewport: viewport
        } as any);

        renderTaskRef.current = task;

        await task.promise;
      } catch (error: any) {
        if (error.name === 'RenderingCancelledException' || error.message?.includes('cancelled')) {
          // Normal cancellation, ignore
        } else {
          console.error('PDF render error:', error);
        }
      } finally {
        if (isCurrent) {
          renderTaskRef.current = null;
        }
      }
    };

    renderPage();

    return () => {
      isCurrent = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdf, pageNumber]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setCursorPos({ x, y });
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      // If clicking background, deselect
      if (e.target === containerRef.current || e.target === canvasRef.current) {
        onSelectAnnotation(null);
        onPageClick(x, y);
      }
    }
  };

  return (
    <div 
      ref={containerRef} 
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden select-none ${placingSignature ? 'cursor-none' : 'cursor-crosshair'}`}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <canvas ref={canvasRef} />
      
      {/* Signature Placement Preview */}
      {placingSignature && (
        <div 
          className="absolute pointer-events-none opacity-50 z-50 transition-transform duration-75"
          style={{ 
            left: `${cursorPos.x * 100}%`, 
            top: `${cursorPos.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '100px'
          }}
        >
          <img src={placingSignature} alt="Signature Preview" className="w-full h-auto" />
        </div>
      )}

      {/* Annotations Layer */}
      {annotations.map((ann) => {
        const isSelected = selectedAnnotationId === ann.id;
        
        return (
          <AnnotationObject
            key={ann.id}
            ann={ann}
            isSelected={isSelected}
            onSelect={() => onSelectAnnotation(ann.id)}
            onUpdatePosition={(x, y) => onUpdatePosition(ann.id, x, y)}
            onUpdatePositionLive={(x, y) => onUpdatePositionLive(ann.id, x, y)}
            onUpdateSize={(w, h) => onUpdateSize(ann.id, w, h)}
            onUpdateSizeLive={(w, h) => onUpdateSizeLive(ann.id, w, h)}
            onUpdateContent={(content) => onUpdateAnnotation(ann.id, content)}
            onCommitContent={(content) => onCommitAnnotation(ann.id, content)}
            containerDimensions={dimensions}
            containerRef={containerRef}
          />
        );
      })}
    </div>
  );
}

interface AnnotationObjectProps {
  key?: React.Key;
  ann: CustomAnnotation;
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdatePositionLive: (x: number, y: number) => void;
  onUpdateSize: (width: number, height?: number) => void;
  onUpdateSizeLive: (width: number, height?: number) => void;
  onUpdateContent: (content: string) => void;
  onCommitContent: (content: string) => void;
  containerDimensions: { width: number, height: number };
  containerRef: React.RefObject<HTMLDivElement>;
}

function AnnotationObject({ 
  ann, 
  isSelected, 
  onSelect, 
  onUpdatePosition, 
  onUpdatePositionLive,
  onUpdateSize,
  onUpdateSizeLive,
  onUpdateContent,
  onCommitContent,
  containerDimensions,
  containerRef
}: AnnotationObjectProps) {
  // Use a ref to store the initial drag position to prevent drift
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: ann.x, y: ann.y });

  return (
    <motion.div 
      onPanStart={(e) => {
        e.stopPropagation();
        isDragging.current = true;
        dragStartPos.current = { x: ann.x, y: ann.y };
        onSelect();
      }}
      onPan={(e, info) => {
        e.stopPropagation();
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const deltaX = info.offset.x / rect.width;
          const deltaY = info.offset.y / rect.height;
          
          onUpdatePositionLive(
            Math.max(0, Math.min(1, dragStartPos.current.x + deltaX)), 
            Math.max(0, Math.min(1, dragStartPos.current.y + deltaY))
          );
        }
      }}
      onPanEnd={(e, info) => {
        setTimeout(() => { isDragging.current = false; }, 50);
        
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const deltaX = info.offset.x / rect.width;
          const deltaY = info.offset.y / rect.height;
          
          onUpdatePosition(
            Math.max(0, Math.min(1, dragStartPos.current.x + deltaX)), 
            Math.max(0, Math.min(1, dragStartPos.current.y + deltaY))
          );
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging.current) {
          onSelect();
        }
      }}
      className="absolute w-max"
      style={{ 
        left: `${ann.x * 100}%`, 
        top: `${ann.y * 100}%`,
        zIndex: isSelected ? 50 : 10
      }}
    >
      <div className="relative p-8 -translate-x-1/2 -translate-y-1/2 group cursor-move">
        <div className={`relative p-1.5 ${isSelected ? 'ring-2 ring-primary ring-offset-2 rounded-sm' : 'group-hover:ring-1 group-hover:ring-primary/20 rounded-sm'}`}>
          {isSelected && (
            <>
              {/* Corner Resize Handles using onPan for absolute control without nested drag issues */}
              {[
                { pos: 'bottom-right', class: '-bottom-1.5 -right-1.5 cursor-se-resize' },
                { pos: 'bottom-left', class: '-bottom-1.5 -left-1.5 cursor-sw-resize' },
                { pos: 'top-right', class: '-top-1.5 -right-1.5 cursor-ne-resize' },
                { pos: 'top-left', class: '-top-1.5 -left-1.5 cursor-nw-resize' },
              ].map((handle) => (
                <motion.div 
                  key={handle.pos}
                  onPanStart={(e) => e.stopPropagation()}
                  onPan={(e, info) => {
                    e.stopPropagation();
                    if (containerRef.current) {
                      const rect = containerRef.current.getBoundingClientRect();
                      const currentSize = ann.width || (ann.type === 'text' ? 0.03 : 0.05);
                      const multiplier = handle.pos.includes('right') ? 1 : -1;
                      const delta = (info.delta.x / rect.width) * multiplier * 0.5;
                      onUpdateSizeLive(Math.max(0.005, Math.min(0.8, currentSize + delta)));
                    }
                  }}
                  onPanEnd={(e, info) => {
                    e.stopPropagation();
                    if (containerRef.current) {
                      const rect = containerRef.current.getBoundingClientRect();
                      const currentSize = ann.width || (ann.type === 'text' ? 0.03 : 0.05);
                      const multiplier = handle.pos.includes('right') ? 1 : -1;
                      const delta = (info.delta.x / rect.width) * multiplier * 0.5;
                      onUpdateSize(Math.max(0.005, Math.min(0.8, currentSize + delta)));
                    }
                  }}
                  className={`absolute w-3.5 h-3.5 bg-white border-2 border-primary rounded-full z-50 shadow-md ${handle.class}`}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ))}
            </>
          )}
          
          {ann.type === 'text' && (
            <div className="relative group/text grid place-items-center">
              <div 
                className="col-start-1 row-start-1 invisible whitespace-pre px-2 py-1 text-sm font-bold min-w-[10px] text-center pointer-events-none"
                style={{ 
                  fontSize: `${(ann.width || 0.03) * containerDimensions.width}px`,
                  fontFamily: 'inherit',
                }}
              >
                {ann.content || 'Type here'}
                {ann.content?.endsWith('\n') ? <br /> : null}
              </div>
              <textarea 
                autoFocus={isSelected}
                value={ann.content}
                placeholder="Type here"
                onChange={(e) => onUpdateContent(e.target.value)}
                onBlur={(e) => onCommitContent(e.target.value)}
                className={`col-start-1 row-start-1 w-full h-full resize-none overflow-hidden border rounded px-2 py-1 text-sm font-bold text-center outline-none focus:ring-0 transition-colors selection:bg-yellow-400 selection:text-black ${isSelected ? 'bg-white' : 'bg-white/50'}`}
                style={{ 
                  color: ann.color || '#000000',
                  borderColor: (ann.color || '#000000') + (isSelected ? '80' : '40'),
                  fontSize: `${(ann.width || 0.03) * containerDimensions.width}px`,
                  fieldSizing: 'content',
                } as any}
                rows={1}
              />
            </div>
          )}
          
          {ann.type === 'check' && (
            <Check 
              className="drop-shadow-sm pointer-events-none" 
              style={{ 
                color: ann.color || '#000000', 
                width: (ann.width || 0.05) * containerDimensions.width, 
                height: (ann.width || 0.05) * containerDimensions.width 
              }} 
            />
          )}
          {ann.type === 'cross' && (
            <X 
              className="drop-shadow-sm pointer-events-none" 
              style={{ 
                color: ann.color || '#000000', 
                width: (ann.width || 0.05) * containerDimensions.width, 
                height: (ann.width || 0.05) * containerDimensions.width 
              }} 
            />
          )}
          {ann.type === 'dot' && (
            <Circle 
              className="fill-current pointer-events-none" 
              style={{ 
                color: ann.color || '#000000', 
                width: (ann.width || 0.02) * containerDimensions.width, 
                height: (ann.width || 0.02) * containerDimensions.width 
              }} 
            />
          )}
          
          {ann.type === 'signature' && ann.imageUrl && (
            <div className="relative group/sig">
              <img 
                src={ann.imageUrl} 
                className="pointer-events-none select-none max-w-none" 
                style={{ width: ann.width ? ann.width * containerDimensions.width : 'auto', height: 'auto' }}
                alt="signature"
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ContextualToolbar({ annotation, onUpdateColor, onUpdateFontSize, onDelete, onDeselect }: {
  annotation: CustomAnnotation;
  onUpdateColor: (color: string) => void;
  onUpdateFontSize: (delta: number) => void;
  onDelete: () => void;
  onDeselect: () => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 p-2 bg-background border shadow-2xl rounded-2xl"
    >
      <div className="flex gap-1 pr-2 border-r">
        {COLORS.map(c => (
          <button
            key={c.value}
            onClick={() => onUpdateColor(c.value)}
            className={`w-6 h-6 rounded-full border-2 ${annotation.color === c.value ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      
      {annotation.type === 'text' && (
        <div className="flex gap-1 pr-2 border-r">
          <Button variant="ghost" size="icon" onClick={() => onUpdateFontSize(0.005)} className="h-8 w-8">
            <span className="text-lg font-bold">A+</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onUpdateFontSize(-0.005)} className="h-8 w-8">
            <span className="text-sm font-bold">A-</span>
          </Button>
        </div>
      )}

      <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-destructive hover:bg-destructive/10">
        <Trash2 className="w-4 h-4" />
      </Button>
      
      <Button variant="ghost" size="icon" onClick={onDeselect} className="h-8 w-8">
        <X className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}

// Signature Pad Component
function SignatureDialog({ isOpen, onClose, onConfirm }: { isOpen: boolean, onClose: () => void, onConfirm: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.beginPath(); // New path for next stroke
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const clear = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleConfirm = () => {
    if (canvasRef.current) {
      // Check if it's empty (rough check)
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onConfirm(dataUrl);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Draw Signature</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 pt-4">
          <div className="relative border-2 border-dashed rounded-2xl bg-white overflow-hidden w-full h-48 cursor-crosshair">
            <canvas 
              ref={canvasRef}
              width={400}
              height={192}
              className="w-full h-full"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <div className="flex w-full space-x-2">
            <Button variant="outline" className="flex-1 rounded-2xl font-bold" onClick={clear}>
              Clear
            </Button>
            <Button className="flex-1 rounded-2xl font-bold" onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
