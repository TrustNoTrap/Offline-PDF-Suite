import { useEffect, useState } from 'react';
import { getHistory, deleteFromHistory, PDFHistoryItem, clearHistory } from '@/lib/history';
import { downloadBlob } from '@/lib/pdf-tools';
import { Button } from '@/components/ui/button';
import { 
  History, 
  Download, 
  Trash2, 
  FileText, 
  Clock, 
  Search,
  Trash,
  AlertCircle,
  FileStack,
  Scissors,
  MoveVertical,
  Image as ImageIcon,
  SearchCode,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  ArrowUpDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const ITEMS_PER_PAGE = 5;

export function PDFHistory() {
  const [history, setHistory] = useState<PDFHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const items = await getHistory();
      setHistory(items);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFromHistory(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      toast.success("Item deleted from history.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete item.");
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear your entire history? This cannot be undone.")) return;
    
    try {
      await clearHistory();
      setHistory([]);
      toast.success("History cleared.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to clear history.");
    }
  };

  const handleDownload = (item: PDFHistoryItem) => {
    let downloadName = item.name;
    const suffix = `_${item.type}`;
    if (!downloadName.toLowerCase().includes(item.type.toLowerCase())) {
      downloadName = downloadName.replace(/\.pdf$/i, '') + suffix + '.pdf';
    }
    downloadBlob(item.blob, downloadName, 'application/pdf');
  };

  const sortedHistory = [...history].sort((a, b) => {
    if (sortOrder === 'desc') return b.timestamp - a.timestamp;
    return a.timestamp - b.timestamp;
  });

  const filteredHistory = sortedHistory.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.type.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'merge': return <FileStack className="w-6 h-6" />;
      case 'split': return <Scissors className="w-6 h-6" />;
      case 'reorder': return <MoveVertical className="w-6 h-6" />;
      case 'image-to-pdf': return <ImageIcon className="w-6 h-6" />;
      case 'ocr': return <SearchCode className="w-6 h-6" />;
      default: return <FileText className="w-6 h-6" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'merge': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'split': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'reorder': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'image-to-pdf': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'ocr': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 ml-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 rounded-lg bg-slate-500/10 text-slate-500">
              <History className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Processing History</CardTitle>
          </div>
          {history.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearAll}
              className="text-destructive hover:bg-destructive/10 font-bold rounded-xl"
            >
              <Trash className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
        <CardDescription className="text-lg">
          View and re-download your previously processed PDF files.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search by filename or operation type..." 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-12 h-14 rounded-2xl border-muted-foreground/20 focus:ring-primary bg-white dark:bg-white/5 shadow-sm"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="h-14 px-6 rounded-2xl border-muted-foreground/20 font-bold"
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium">Loading your history...</p>
          </div>
        ) : paginatedHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-muted/20 rounded-[2rem] border-2 border-dashed">
            <div className="p-4 rounded-full bg-muted text-muted-foreground">
              <Clock className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">No history found</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                {search ? "No items match your search criteria." : "Your processed files will appear here for easy access."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {paginatedHistory.map((item) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={item.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-[2rem] border bg-white dark:bg-white/5 hover:border-primary/50 hover:shadow-xl transition-all space-y-4 sm:space-y-0 shadow-sm"
                >
                  <div className="flex items-center space-x-4">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      getBadgeColor(item.type)
                    )}>
                      {getIcon(item.type)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold text-lg truncate max-w-[200px] md:max-w-md">{item.name}</span>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground font-medium mt-1">
                        <Badge variant="outline" className={cn("capitalize font-bold rounded-lg border", getBadgeColor(item.type))}>
                          {item.type.replace(/-/g, ' ')}
                        </Badge>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDate(item.timestamp)}
                        </span>
                        <span className="flex items-center">
                          <HardDrive className="w-3 h-3 mr-1" />
                          {formatSize(item.size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl h-12 w-12 border-muted-foreground/20 hover:bg-primary hover:text-white transition-colors"
                      onClick={() => handleDownload(item)}
                    >
                      <Download className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl h-12 w-12 border-muted-foreground/20 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-4 pt-4">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="rounded-xl h-10 w-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm font-bold">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="rounded-xl h-10 w-10"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}

        <div className="flex items-center space-x-2 p-4 rounded-xl bg-blue-500/5 text-blue-600 border border-blue-500/10">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-xs font-medium">
            History is stored locally in your browser's IndexedDB. Clearing your browser data will remove this history.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
