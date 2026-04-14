import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, Hash, Type, Calendar, FileText, FilePlus } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type NamingMode = 'timestamp' | 'prefix' | 'both' | 'original' | 'prefix_original';

interface NamingOptionsProps {
  prefix: string;
  onPrefixChange: (value: string) => void;
  mode: NamingMode;
  onModeChange: (mode: NamingMode) => void;
  placeholder?: string;
  originalName?: string;
}

export function NamingOptions({ 
  prefix, 
  onPrefixChange, 
  mode, 
  onModeChange,
  placeholder = "e.g., project_alpha",
  originalName = "document"
}: NamingOptionsProps) {
  const getPreviewName = () => {
    const timestamp = "1713113542"; // Example timestamp
    const base = originalName.replace(/\.pdf$/i, '');
    switch (mode) {
      case 'timestamp': return `${base}_${timestamp}.pdf`;
      case 'prefix': return `${prefix || 'result'}.pdf`;
      case 'both': return `${prefix || 'result'}_${timestamp}.pdf`;
      case 'original': return `${base}.pdf`;
      case 'prefix_original': return `${prefix || 'result'}_${base}.pdf`;
      default: return `${base}_${timestamp}.pdf`;
    }
  };

  return (
    <div className="space-y-6 p-6 rounded-[2rem] bg-muted/30 border border-muted-foreground/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm font-bold text-muted-foreground">
          <Settings2 className="w-4 h-4" />
          <span>Output Naming Strategy</span>
        </div>
        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">
          Configurable
        </div>
      </div>

      <RadioGroup 
        value={mode} 
        onValueChange={(v) => onModeChange(v as NamingMode)}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        <Label
          htmlFor="mode-original"
          className={cn(
            "flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all text-center",
            mode === 'original' && "border-primary bg-primary/5"
          )}
        >
          <RadioGroupItem value="original" id="mode-original" className="sr-only" />
          <FileText className="mb-2 h-5 w-5 text-muted-foreground" />
          <span className="text-[10px] font-bold leading-tight">Original<br/>Name</span>
        </Label>

        <Label
          htmlFor="mode-timestamp"
          className={cn(
            "flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all text-center",
            mode === 'timestamp' && "border-primary bg-primary/5"
          )}
        >
          <RadioGroupItem value="timestamp" id="mode-timestamp" className="sr-only" />
          <Calendar className="mb-2 h-5 w-5 text-muted-foreground" />
          <span className="text-[10px] font-bold leading-tight">Original +<br/>Timestamp</span>
        </Label>
        
        <Label
          htmlFor="mode-prefix"
          className={cn(
            "flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all text-center",
            mode === 'prefix' && "border-primary bg-primary/5"
          )}
        >
          <RadioGroupItem value="prefix" id="mode-prefix" className="sr-only" />
          <Type className="mb-2 h-5 w-5 text-muted-foreground" />
          <span className="text-[10px] font-bold leading-tight">Custom<br/>Prefix</span>
        </Label>

        <Label
          htmlFor="mode-prefix_original"
          className={cn(
            "flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all text-center",
            mode === 'prefix_original' && "border-primary bg-primary/5"
          )}
        >
          <RadioGroupItem value="prefix_original" id="mode-prefix_original" className="sr-only" />
          <FilePlus className="mb-2 h-5 w-5 text-muted-foreground" />
          <span className="text-[10px] font-bold leading-tight">Prefix +<br/>Original</span>
        </Label>

        <Label
          htmlFor="mode-both"
          className={cn(
            "flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all text-center sm:col-span-2",
            mode === 'both' && "border-primary bg-primary/5"
          )}
        >
          <RadioGroupItem value="both" id="mode-both" className="sr-only" />
          <Hash className="mb-2 h-5 w-5 text-muted-foreground" />
          <span className="text-[10px] font-bold leading-tight">Prefix +<br/>Timestamp</span>
        </Label>
      </RadioGroup>

      {(mode === 'prefix' || mode === 'both' || mode === 'prefix_original') && (
        <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
          <Label htmlFor="prefix" className="text-sm font-bold ml-1">Custom Prefix</Label>
          <Input
            id="prefix"
            placeholder={placeholder}
            value={prefix}
            onChange={(e) => onPrefixChange(e.target.value)}
            className="rounded-xl h-12 border-muted-foreground/20 focus:ring-primary bg-white dark:bg-white/5"
          />
        </div>
      )}

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
        <p className="text-xs text-muted-foreground font-medium mb-1">Preview filename:</p>
        <code className="text-sm text-primary font-black break-all">{getPreviewName()}</code>
      </div>
    </div>
  );
}
