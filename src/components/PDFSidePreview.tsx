import { FileText, Eye } from 'lucide-react';
import { PDFPreview } from './PDFPreview';

type PreviewFile = File | Uint8Array | null;

interface PDFSidePreviewProps {
  file: PreviewFile;
}

export function PDFSidePreview({ file }: PDFSidePreviewProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-white/5 border dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/5">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/10 shrink-0">
        <div className="flex items-center space-x-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Live Preview</span>
        </div>
        {file && (
          <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            PDF
          </span>
        )}
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-4">
        {file ? (
          <PDFPreview file={file} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4 px-6">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-muted-foreground">No preview yet</p>
              <p className="text-xs text-muted-foreground/70 font-medium leading-relaxed">
                Load a file or process your PDF to see a live preview here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
