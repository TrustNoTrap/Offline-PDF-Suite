/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { PDFMerge } from './components/PDFMerge';
import { PDFSplit } from './components/PDFSplit';
import { PDFReorder } from './components/PDFReorder';
import { ImageToPDF } from './components/ImageToPDF';
import { PDFOCR } from './components/PDFOCR';
import { PDFHistory } from './components/PDFHistory';
import { ModeToggle } from './components/ModeToggle';
import { 
  FileStack, 
  Scissors, 
  MoveVertical, 
  Image as ImageIcon, 
  ShieldCheck,
  Github,
  History,
  Zap,
  Lock,
  Globe, 
  FileText,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState("merge");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // ============================================================================
  // EXTENSIBILITY GUIDE: Adding a new PDF Tool
  // ============================================================================
  // To add a new feature (e.g., "Compress PDF", "Watermark PDF"):
  // 1. Create a new component in `src/components/` (e.g., `PDFCompress.tsx`).
  // 2. Import the component and an appropriate icon from `lucide-react` above.
  // 3. Add a new object to this `tools` array.
  //    - `id`: Unique string identifier for the tab.
  //    - `label`: Display name in the UI.
  //    - `icon`: The Lucide icon component.
  //    - `component`: Your new React component.
  //    - `activeClass`: Tailwind classes for the active tab state (color theming).
  // ============================================================================
  const tools = [
    { id: "merge", label: "Merge", icon: FileStack, component: PDFMerge, activeClass: "data-active:!bg-blue-500/10 data-active:!text-blue-500" },
    { id: "split", label: "Split", icon: Scissors, component: PDFSplit, activeClass: "data-active:!bg-purple-500/10 data-active:!text-purple-500" },
    { id: "reorder", label: "Reorder", icon: MoveVertical, component: PDFReorder, activeClass: "data-active:!bg-orange-500/10 data-active:!text-orange-500" },
    { id: "image", label: "Image to PDF", icon: ImageIcon, component: ImageToPDF, activeClass: "data-active:!bg-emerald-500/10 data-active:!text-emerald-500" },
    { id: "ocr", label: "OCR", icon: Search, component: PDFOCR, activeClass: "data-active:!bg-amber-500/10 data-active:!text-amber-500" },
    { id: "history", label: "History", icon: History, component: PDFHistory, activeClass: "data-active:!bg-slate-500/10 data-active:!text-slate-500" },
  ];

  const scrollToTop = () => {
    window.scrollTo(0, 0); // Start of the page screen
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] text-[#1A1A1A] dark:text-[#F8F9FA] font-sans selection:bg-primary/20 transition-colors duration-300">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-black/80 backdrop-blur-xl dark:border-white/10">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="p-2.5 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" onClick={() => scrollToTop()} />
            </div>
            <span className="text-2xl font-black tracking-tighter">PDF<span className="text-primary">Suite</span></span>
          </div>
          
          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex items-center space-x-1 mr-4">
              <a href="#features" className="px-4 py-2 text-sm font-bold hover:text-primary transition-colors">Features</a>
              <a href="#security" className="px-4 py-2 text-sm font-bold hover:text-primary transition-colors">Security</a>
            </nav>
            <ModeToggle />
            <a href="https://github.com/TrustNoTrap/Offline-PDF-Suite" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <section className="max-w-4xl mx-auto text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold mb-6 border border-primary/20">
              <Zap className="w-4 h-4" />
              <span>100% Client-Side Processing</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[1.1]">
              Professional PDF tools, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">completely offline.</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
              Merge, split, and reorder PDF pages with military-grade privacy. Your files never leave your device.
            </p>
          </motion.div>
        </section>

        {/* Tools Interface */}
        <section className="max-w-5xl mx-auto">
          <Tabs defaultValue="merge" onValueChange={setActiveTab} className="w-full">
            <div className="relative w-full max-w-full flex items-center justify-center mb-12">
              {canScrollLeft && (
                <div className="absolute left-0 z-10 h-full flex items-center pr-4 bg-gradient-to-r from-[#F8F9FA] dark:from-[#0A0A0A] to-transparent pointer-events-none">
                  <button 
                    onClick={() => scrollContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                    className="p-2 rounded-full bg-white dark:bg-white/10 shadow-md border dark:border-white/10 text-muted-foreground hover:text-foreground pointer-events-auto"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              <TabsList 
                ref={scrollContainerRef}
                onScroll={checkScroll}
                className="!h-auto p-3 lg:p-4 bg-white dark:bg-white/5 border dark:border-white/10 rounded-[2.5rem] shadow-xl flex-nowrap lg:flex-wrap justify-start lg:justify-center gap-2 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-w-full w-full lg:w-auto items-center scroll-smooth"
              >
                {tools.map((tool) => (
                  <TabsTrigger 
                    key={tool.id} 
                    value={tool.id}
                    className={`!h-14 lg:!h-12 rounded-full px-6 transition-all font-bold text-base shrink-0 data-active:shadow-lg ${tool.activeClass}`}
                  >
                    <tool.icon className="w-6 h-6 lg:w-4 lg:h-4 lg:mr-2" />
                    <span className="hidden lg:inline">{tool.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {canScrollRight && (
                <div className="absolute right-0 z-10 h-full flex items-center pl-4 bg-gradient-to-l from-[#F8F9FA] dark:from-[#0A0A0A] to-transparent pointer-events-none">
                  <button 
                    onClick={() => scrollContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                    className="p-2 rounded-full bg-white dark:bg-white/10 shadow-md border dark:border-white/10 text-muted-foreground hover:text-foreground pointer-events-auto"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-white/5 border dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-black/5"
            >
              <AnimatePresence mode="wait">
                {tools.map((tool) => (
                  <TabsContent key={tool.id} value={tool.id} className="mt-0 focus-visible:outline-none">
                    <tool.component />
                  </TabsContent>
                ))}
              </AnimatePresence>
            </motion.div>
          </Tabs>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-32">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight mb-4">Why use PDFSuite?</h2>
            <p className="text-muted-foreground text-lg font-medium">The most secure way to handle your documents.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-[2rem] bg-white dark:bg-white/5 border dark:border-white/10 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Privacy First</h3>
              <p className="text-muted-foreground leading-relaxed font-medium">
                Your files are processed entirely in your browser. No data is ever uploaded to any server.
              </p>
            </div>
            <div className="p-8 rounded-[2rem] bg-white dark:bg-white/5 border dark:border-white/10 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Blazing Fast</h3>
              <p className="text-muted-foreground leading-relaxed font-medium">
                Leveraging modern WebAssembly and PDF libraries for near-instant processing of even large files.
              </p>
            </div>
            <div className="p-8 rounded-[2rem] bg-white dark:bg-white/5 border dark:border-white/10 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Works Offline</h3>
              <p className="text-muted-foreground leading-relaxed font-medium">
                Once loaded, the app works without an internet connection. Perfect for secure environments.
              </p>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section id="security" className="py-20 rounded-[3rem] bg-primary text-white p-12 md:p-20 relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-bold mb-8">
              <ShieldCheck className="w-4 h-4" />
              <span>Enterprise Security</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-tight">
              Your documents are <br />none of our business.
            </h2>
            <p className="text-xl md:text-2xl text-white/80 font-medium mb-10 leading-relaxed">
              We built PDFSuite with a zero-trust architecture. We don't have a backend, we don't have a database, and we don't want your data.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2 bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">No Server Uploads</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">Local Storage Only</span>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[600px] h-[600px] bg-white/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-[400px] h-[400px] bg-black/10 rounded-full blur-[80px]" />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t dark:border-white/10 py-12 bg-white dark:bg-black/40">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-8 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary text-white">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xl font-black tracking-tighter">PDFSuite</span>
            </div>
            
            // <div className="flex items-center space-x-8 text-sm font-bold text-muted-foreground">
            //   <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            //   <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            //   <a href="#" className="hover:text-primary transition-colors">Contact</a>
            // </div>
            
            <p className="text-sm font-medium text-muted-foreground">
              © {new Date().getFullYear()} PDFSuite. Built for privacy.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

