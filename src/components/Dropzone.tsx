import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File as FileIcon, X, AlertCircle, Clipboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  className?: string;
  files?: File[];
  onRemoveFile?: (index: number) => void;
  validator?: (file: File) => string | null;
  maxFiles?: number;
}

export function Dropzone({ 
  onFilesAdded, 
  accept, 
  multiple = true, 
  className,
  files = [],
  onRemoveFile,
  validator,
  maxFiles
}: DropzoneProps) {
  const [error, setError] = useState<string | null>(null);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      // Filter by accept if provided
      const filteredFiles = pastedFiles.filter(file => {
        if (!accept) return true;
        const acceptedTypes = Object.keys(accept);
        return acceptedTypes.some(type => {
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.replace('/*', ''));
          }
          return file.type === type;
        });
      });

      if (filteredFiles.length > 0) {
        onDrop(filteredFiles, []);
      } else {
        setError("Pasted file type not supported.");
      }
    }
  }, [accept, onFilesAdded, validator, maxFiles, files.length]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      setError("Some files were rejected. Please check the file types.");
      return;
    }

    if (maxFiles && files.length + acceptedFiles.length > maxFiles) {
      setError(`You can only upload up to ${maxFiles} file(s).`);
      return;
    }

    if (validator) {
      for (const file of acceptedFiles) {
        const validationError = validator(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }
    }

    onFilesAdded(acceptedFiles);
  }, [onFilesAdded, validator, maxFiles, files.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: multiple && (!maxFiles || files.length < maxFiles),
  } as any);

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-4 overflow-hidden group",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[0.98] ring-4 ring-primary/10" 
            : "border-muted-foreground/20 dark:border-white/10 hover:border-primary/50 hover:bg-muted/50 dark:hover:bg-white/5",
          error && "border-destructive/50 bg-destructive/5",
          files.length > 0 && "py-8"
        )}
      >
        <input {...getInputProps()} />
        
        {/* Animated background pulse when dragging */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-primary/5 pointer-events-none"
            />
          )}
        </AnimatePresence>

        <div className={cn(
          "p-5 rounded-2xl transition-transform duration-300",
          isDragActive ? "bg-primary text-white scale-110" : "bg-primary/10 text-primary group-hover:scale-110"
        )}>
          <Upload className="w-10 h-10" />
        </div>
        
        <div className="space-y-1">
          <p className="text-xl font-bold tracking-tight">
            {isDragActive ? "Drop them now!" : "Upload your files"}
          </p>
          <p className="text-muted-foreground">
            {isDragActive 
              ? "Release to start processing" 
              : multiple ? "Drag and drop multiple files or click to browse" : "Drag and drop a file or click to browse"}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-2 text-destructive text-sm font-medium bg-destructive/10 px-4 py-2 rounded-full"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {files.map((file, index) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground group hover:shadow-md transition-all"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <FileIcon className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                {onRemoveFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(index);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
