import React, { useState, useRef, useCallback, useEffect, ChangeEvent } from 'react';
import { Dropzone } from './Dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  FilePen,
  Loader2,
  Download,
  Trash2,
  RotateCw,
  RotateCcw,
  Copy,
  FilePlus,
  FileInput,
  Undo2,
  Redo2,
  AlertCircle,
  GripVertical,
  FileText,
  CheckSquare,
  Square,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { pdfWorkerUrl, generatePDFThumbnails } from '@/lib/pdf-thumbnails';
import { buildEditedPDF, EditedPage, generateFileName, downloadBlob, PDFError, validatePDF } from '@/lib/pdf-tools';
import { addToHistory } from '@/lib/history';
import { NamingOptions, NamingMode } from './NamingOptions';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ─── types ───────────────────────────────────────────────────────────────────

type InternalPage = EditedPage & {
  thumbnail: string | null; // base64 data-URL or null while loading
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeId() {
  return crypto.randomUUID();
}

/** Render a single PDF page from a Uint8Array and return a data-URL thumbnail */
async function renderPageThumbnail(
  pdfBytes: Uint8Array,
  pageIndex: number,
  scale = 0.4
): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport } as any).promise;
  return canvas.toDataURL('image/jpeg', 0.75);
}

// ─── component ───────────────────────────────────────────────────────────────

type PreviewFile = File | Uint8Array | null;

export function PDFEditor({ onPreviewChange }: { onPreviewChange?: (file: PreviewFile) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<InternalPage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [namingMode, setNamingMode] = useState<NamingMode>('both');

  // Cached result bytes: cleared whenever pages are mutated, reused on download
  const [cachedResultBytes, setCachedResultBytes] = useState<Uint8Array | null>(null);

  // undo / redo
  const [undoStack, setUndoStack] = useState<InternalPage[][]>([]);
  const [redoStack, setRedoStack] = useState<InternalPage[][]>([]);

  // hidden file input for "insert from PDF"
  const insertFileRef = useRef<HTMLInputElement>(null);
  const insertAfterIdRef = useRef<string | null>(null);

  // Ref that always holds the latest keyboard handler to avoid stale closures
  // while keeping the event listener registration stable (empty deps array).
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});

  // ── commit a new page state and push to undo stack ──────────────────────────
  const commit = useCallback(
    (newPages: InternalPage[], prevPages: InternalPage[]) => {
      setPages(newPages);
      setUndoStack((s: InternalPage[][]) => [...s, prevPages]);
      setRedoStack([]);
      // Invalidate the cached download result whenever the page structure changes
      setCachedResultBytes(null);
    },
    []
  );

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((s: InternalPage[][]) => [...s, pages]);
    setPages(prev);
    setUndoStack((s: InternalPage[][]) => s.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((s: InternalPage[][]) => [...s, pages]);
    setPages(next);
    setRedoStack((s: InternalPage[][]) => s.slice(0, -1));
  };

  // ── keyboard shortcuts ───────────────────────────────────────────────────────
  // Keep the latest handler in a ref so the event listener never goes stale
  // without needing to re-register on every state change.
  onKeyRef.current = (e: KeyboardEvent) => {
    if (!file) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'z') { e.preventDefault(); undo(); }
    if (mod && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
      e.preventDefault();
      deleteSelected();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── auto-preview after every page edit ───────────────────────────────────────
  // Starts a preview build immediately after each page change.  The cleanup
  // function sets a `cancelled` flag so that any in-flight build whose result
  // arrives after a newer change has already started is silently discarded.
  useEffect(() => {
    if (!file || pages.length === 0 || isLoadingPages) return;

    let cancelled = false;
    const targetFile = file;
    const targetPages = pages;

    (async () => {
      try {
        const resultBytes = await buildEditedPDF(targetFile, targetPages);
        if (cancelled) return;
        setCachedResultBytes(resultBytes);
        onPreviewChange?.(resultBytes);
      } catch {
        // Silently ignore auto-preview errors; the user can still save manually
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pages, file, isLoadingPages, onPreviewChange]);

  // ── load PDF ─────────────────────────────────────────────────────────────────
  const handleFilesAdded = async (newFiles: File[]) => {
    const f = newFiles[0];
    setError(null);
    setIsLoadingPages(true);
    setCachedResultBytes(null);
    try {
      await validatePDF(f);
      setFile(f);
      onPreviewChange?.(f);
      setSelectedIds(new Set());
      setUndoStack([]);
      setRedoStack([]);

      const bytes = await f.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const count = pdfDoc.getPageCount();

      // Build initial page descriptors without thumbnails first
      const initial: InternalPage[] = Array.from({ length: count }, (_, i) => ({
        id: makeId(),
        sourceType: 'original',
        originalIndex: i,
        rotation: 0,
        thumbnail: null,
      }));
      setPages(initial);

      // Generate thumbnails
      const thumbs = await generatePDFThumbnails(f);
      setPages(
        initial.map((p, i) => ({ ...p, thumbnail: thumbs[i] ?? null }))
      );
    } catch (err) {
      const msg = err instanceof PDFError ? err.message : 'Failed to load PDF.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingPages(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPages([]);
    setSelectedIds(new Set());
    setUndoStack([]);
    setRedoStack([]);
    setCachedResultBytes(null);
    setError(null);
    onPreviewChange?.(null);
  };

  // ── selection helpers ────────────────────────────────────────────────────────
  const toggleSelect = (id: string, multi: boolean) => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (!multi) {
        if (next.size === 1 && next.has(id)) {
          next.clear();
        } else {
          next.clear();
          next.add(id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const selectAll = () =>
    setSelectedIds(new Set(pages.map((p: InternalPage) => p.id)));

  const clearSelection = () => setSelectedIds(new Set());

  // ── page operations ──────────────────────────────────────────────────────────

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    const remaining = pages.filter((p: InternalPage) => !selectedIds.has(p.id));
    if (remaining.length === 0) {
      toast.error('You cannot delete all pages.');
      return;
    }
    commit(remaining, pages);
    setSelectedIds(new Set());
  };

  const rotatePage = (id: string, delta: 90 | -90 | 180) => {
    commit(
      pages.map((p: InternalPage) =>
        p.id === id
          ? { ...p, rotation: ((p.rotation + delta + 360) % 360) as 0 | 90 | 180 | 270 }
          : p
      ),
      pages
    );
  };

  const rotateSelected = (delta: 90 | -90) => {
    if (selectedIds.size === 0) return;
    commit(
      pages.map((p: InternalPage) =>
        selectedIds.has(p.id)
          ? { ...p, rotation: ((p.rotation + delta + 360) % 360) as 0 | 90 | 180 | 270 }
          : p
      ),
      pages
    );
  };

  const duplicatePage = (id: string) => {
    const idx = pages.findIndex((p: InternalPage) => p.id === id);
    if (idx === -1) return;
    const original = pages[idx];
    const clone: InternalPage = { ...original, id: makeId() };
    const next = [...pages];
    next.splice(idx + 1, 0, clone);
    commit(next, pages);
  };

  const insertBlankPage = (afterId: string | null) => {
    const blank: InternalPage = {
      id: makeId(),
      sourceType: 'blank',
      originalIndex: -1,
      rotation: 0,
      thumbnail: null,
    };
    if (afterId === null) {
      commit([blank, ...pages], pages);
    } else {
      const idx = pages.findIndex((p: InternalPage) => p.id === afterId);
      const next = [...pages];
      next.splice(idx + 1, 0, blank);
      commit(next, pages);
    }
  };

  const triggerInsertFromPDF = (afterId: string) => {
    insertAfterIdRef.current = afterId;
    insertFileRef.current?.click();
  };

  const handleInsertFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const sourceFile = e.target.files?.[0];
    e.target.value = '';
    if (!sourceFile) return;

    try {
      await validatePDF(sourceFile);
      const bytes = await sourceFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const count = srcDoc.getPageCount();

      // Generate thumbnails for the source pages
      const thumbs = await generatePDFThumbnails(sourceFile);

      const newPages: InternalPage[] = Array.from({ length: count }, (_, i) => ({
        id: makeId(),
        sourceType: 'inserted',
        originalIndex: i,
        sourceFile,
        rotation: 0,
        thumbnail: thumbs[i] ?? null,
      }));

      const afterId = insertAfterIdRef.current;
      let next: InternalPage[];
      if (afterId === null) {
        next = [...pages, ...newPages];
      } else {
        const idx = pages.findIndex((p: InternalPage) => p.id === afterId);
        next = [...pages];
        next.splice(idx + 1, 0, ...newPages);
      }
      commit(next, pages);
      toast.success(`Inserted ${count} page(s) from ${sourceFile.name}`);
    } catch (err) {
      const msg = err instanceof PDFError ? err.message : 'Failed to insert PDF.';
      toast.error(msg);
    }
  };

  // ── save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!file || pages.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      // Reuse the auto-preview cached bytes when available to avoid rebuilding
      const resultBytes = cachedResultBytes || await buildEditedPDF(file, pages);
      // Ensure the cache is populated and the preview reflects the saved result
      setCachedResultBytes(resultBytes);
      onPreviewChange?.(resultBytes);
      const fileName = generateFileName(namingMode, prefix, `edited_${file.name.replace(/\.pdf$/i, '')}`);
      const blob = new Blob([resultBytes as unknown as BlobPart], { type: 'application/pdf' });
      await addToHistory({ name: fileName, type: 'edit', blob, size: blob.size });
      downloadBlob(resultBytes, fileName, 'application/pdf');
      toast.success('PDF saved successfully!');
    } catch (err) {
      const msg = err instanceof PDFError ? err.message : 'Failed to save PDF.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── render ───────────────────────────────────────────────────────────────

  const allSelected = pages.length > 0 && selectedIds.size === pages.length;

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
            <FilePen className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">PDF Editor</CardTitle>
        </div>
        <CardDescription className="text-lg">
          Delete, insert, rotate and reorder pages — all in one place.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        {/* Hidden file input for "insert from PDF" */}
        <input
          ref={insertFileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleInsertFileChosen}
        />

        {/* Drop zone (shown when no file loaded) */}
        {!file && (
          <Dropzone
            onFilesAdded={handleFilesAdded}
            files={[]}
            accept={{ 'application/pdf': ['.pdf'] }}
            multiple={false}
          />
        )}

        {/* Loading spinner */}
        {isLoadingPages && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Analyzing PDF…</p>
          </div>
        )}

        {/* Error banner */}
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

        {/* Editor area */}
        {file && !isLoadingPages && pages.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
            {/* ── File info bar ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-muted/30 border border-muted-foreground/10">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold truncate max-w-[200px] sm:max-w-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {pages.length} page{pages.length !== 1 ? 's' : ''}
                    {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                className="text-muted-foreground hover:text-destructive rounded-xl font-bold"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Close
              </Button>
            </div>

            {/* ── Toolbar ────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-white dark:bg-white/5 border dark:border-white/10 shadow-sm">
              {/* Undo / Redo */}
              <div className="flex items-center space-x-1 border-r pr-3 mr-1">
                <Button
                  variant="ghost" size="icon"
                  onClick={undo} disabled={undoStack.length === 0}
                  className="rounded-xl h-9 w-9" title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={redo} disabled={redoStack.length === 0}
                  className="rounded-xl h-9 w-9" title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Select all / clear */}
              <Button
                variant="ghost" size="sm"
                onClick={allSelected ? clearSelection : selectAll}
                className="rounded-xl h-9 font-bold text-xs"
                title={allSelected ? 'Deselect all' : 'Select all'}
              >
                {allSelected
                  ? <><CheckSquare className="w-4 h-4 mr-1" />Deselect all</>
                  : <><Square className="w-4 h-4 mr-1" />Select all</>}
              </Button>

              {/* Delete selected */}
              <Button
                variant="ghost" size="sm"
                onClick={deleteSelected} disabled={selectedIds.size === 0}
                className="rounded-xl h-9 font-bold text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Delete selected (Delete key)"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete ({selectedIds.size})
              </Button>

              {/* Rotate selected */}
              <Button
                variant="ghost" size="sm"
                onClick={() => rotateSelected(-90)} disabled={selectedIds.size === 0}
                className="rounded-xl h-9 font-bold text-xs"
                title="Rotate selected counter-clockwise"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                CCW
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => rotateSelected(90)} disabled={selectedIds.size === 0}
                className="rounded-xl h-9 font-bold text-xs"
                title="Rotate selected clockwise"
              >
                <RotateCw className="w-4 h-4 mr-1" />
                CW
              </Button>

              <div className="flex-1" />

              {/* Insert blank page at end */}
              <Button
                variant="outline" size="sm"
                onClick={() => insertBlankPage(pages[pages.length - 1]?.id ?? null)}
                className="rounded-xl h-9 font-bold text-xs"
                title="Append a blank page"
              >
                <FilePlus className="w-4 h-4 mr-1" />
                Blank page
              </Button>

              {/* Insert from PDF at end */}
              <Button
                variant="outline" size="sm"
                onClick={() => triggerInsertFromPDF(pages[pages.length - 1]?.id)}
                className="rounded-xl h-9 font-bold text-xs"
                title="Append pages from another PDF"
              >
                <FileInput className="w-4 h-4 mr-1" />
                Insert PDF
              </Button>
            </div>

            {/* ── Pages grid ─────────────────────────────────────────────────── */}
            <Reorder.Group
              axis="y"
              values={pages}
              onReorder={(newOrder: InternalPage[]) => commit(newOrder, pages)}
              className="space-y-3"
            >
              {pages.map((page: InternalPage, idx: number) => {
                const isSelected = selectedIds.has(page.id);
                return (
                  <Reorder.Item
                    key={page.id}
                    value={page}
                    whileDrag={{ scale: 1.02, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.15)' }}
                    className={cn(
                      'flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[1.5rem] border bg-white dark:bg-white/5 cursor-grab active:cursor-grabbing transition-colors group',
                      isSelected
                        ? 'border-rose-500/50 bg-rose-500/5'
                        : 'hover:border-primary/50 hover:bg-primary/5'
                    )}
                  >
                    {/* Drag handle */}
                    <GripVertical className="w-5 h-5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 hidden sm:block" />

                    {/* Checkbox */}
                    <button
                      onClick={(e: React.MouseEvent) => toggleSelect(page.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                      className={cn(
                        'w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-rose-500 border-rose-500 text-white'
                          : 'border-muted-foreground/30 hover:border-rose-500'
                      )}
                      title="Select page (Ctrl/Cmd+Click for multi-select)"
                    >
                      {isSelected && <span className="text-[10px] font-black">✓</span>}
                    </button>

                    {/* Position badge */}
                    <div className="flex flex-col items-center shrink-0 w-8 sm:w-10">
                      <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Pos</span>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm shadow-sm shadow-primary/20">
                        {idx + 1}
                      </div>
                    </div>

                    {/* Thumbnail */}
                    <div
                      className={cn(
                        'w-10 h-14 sm:w-14 sm:h-20 rounded-lg border shadow-sm overflow-hidden bg-white flex items-center justify-center shrink-0',
                        page.rotation !== 0 && 'transition-transform'
                      )}
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    >
                      {page.thumbnail ? (
                        <img
                          src={page.thumbnail}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : page.sourceType === 'blank' ? (
                        <div className="flex flex-col items-center justify-center w-full h-full bg-muted/30">
                          <FileText className="w-4 h-4 text-muted-foreground/40" />
                          <span className="text-[8px] text-muted-foreground font-bold mt-1">BLANK</span>
                        </div>
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    {/* Page info */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-bold text-sm sm:text-base truncate">
                        Page {idx + 1}
                        {page.sourceType === 'blank' && (
                          <span className="ml-2 text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Blank</span>
                        )}
                        {page.sourceType === 'inserted' && (
                          <span className="ml-2 text-xs font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-full">Inserted</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {page.sourceType === 'original' && `Original page ${page.originalIndex + 1}`}
                        {page.sourceType === 'inserted' && `From ${page.sourceFile?.name ?? 'another PDF'} · p${page.originalIndex + 1}`}
                        {page.sourceType === 'blank' && 'US Letter (612 × 792 pt)'}
                        {page.rotation !== 0 && ` · ${page.rotation}° rotated`}
                      </span>
                    </div>

                    {/* Per-page action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); rotatePage(page.id, -90); }}
                        className="h-8 w-8 rounded-xl hover:bg-muted"
                        title="Rotate counter-clockwise"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); rotatePage(page.id, 90); }}
                        className="h-8 w-8 rounded-xl hover:bg-muted"
                        title="Rotate clockwise"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); duplicatePage(page.id); }}
                        className="h-8 w-8 rounded-xl hover:bg-muted"
                        title="Duplicate page"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {/* Insert blank after this page */}
                      <Button
                        variant="ghost" size="icon"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); insertBlankPage(page.id); }}
                        className="h-8 w-8 rounded-xl hover:bg-muted"
                        title="Insert blank page after this"
                      >
                        <FilePlus className="w-3.5 h-3.5" />
                      </Button>
                      {/* Insert from PDF after this page */}
                      <Button
                        variant="ghost" size="icon"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); triggerInsertFromPDF(page.id); }}
                        className="h-8 w-8 rounded-xl hover:bg-muted"
                        title="Insert pages from another PDF after this"
                      >
                        <FileInput className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (pages.length <= 1) { toast.error('Cannot delete the only page.'); return; }
                          commit(pages.filter((p: InternalPage) => p.id !== page.id), pages);
                          setSelectedIds((prev: Set<string>) => { const n = new Set(prev); n.delete(page.id); return n; });
                        }}
                        className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                        title="Delete page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>

            {/* ── Naming + Save ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <NamingOptions
                prefix={prefix}
                onPrefixChange={setPrefix}
                mode={namingMode}
                onModeChange={setNamingMode}
                placeholder="e.g., final_document"
                originalName={file.name}
              />
              <div className="flex flex-col justify-end">
                <Button
                  size="lg"
                  onClick={handleSave}
                  disabled={isProcessing}
                  className="w-full font-bold h-14 px-8 rounded-2xl shadow-lg shadow-rose-500/20 bg-rose-500 hover:bg-rose-600 text-white"
                >
                  {isProcessing ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Saving…</>
                  ) : (
                    <><Download className="mr-2 h-5 w-5" />Save & Download</>
                  )}
                </Button>
              </div>
            </div>

            {/* ── Keyboard hint ───────────────────────────────────────────── */}
            <p className="text-xs text-center text-muted-foreground font-medium">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Ctrl+Z</kbd> Undo
              &nbsp;·&nbsp;
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Ctrl+Y</kbd> Redo
              &nbsp;·&nbsp;
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Delete</kbd> Delete selected
              &nbsp;·&nbsp;
              Drag rows to reorder
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
