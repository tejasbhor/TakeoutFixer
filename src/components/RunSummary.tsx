import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  ExternalLink,
  RefreshCcw,
  FileText,
  ChevronDown,
  ChevronUp,
  Search
} from "lucide-react";
import { RunSummary } from "../types";
import { openOutputFolder } from "../lib/tauri";
import { cn } from "../lib/utils";

interface RunSummaryProps {
  summary: RunSummary;
  onReset: () => void;
}

export default function RunSummaryView({ summary, onReset }: RunSummaryProps) {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="flex flex-col h-full gap-8" role="region" aria-label="Process Completion Summary">
      {summary.dryRun && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-amber-500 uppercase tracking-wider">Scan & Preview Concluded</h4>
            <p className="text-xs text-amber-500/70">Scan successful. No files were modified on your disk.</p>
          </div>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="list">
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <SummaryCard 
                label="Photos Repaired" 
                value={summary.processedOk} 
                icon={<CheckCircle2 className="w-5 h-5" />}
                color="text-emerald-500"
                bg="bg-emerald-500/10"
            />
            <SummaryCard 
                label="Space Saved" 
                value={summary.duplicatesRemoved} 
                icon={<Trash2 className="w-5 h-5" />}
                color="text-blue-500"
                bg="bg-blue-500/10"
            />
            <SummaryCard 
                label="Warnings Found" 
                value={summary.errors} 
                icon={<AlertTriangle className="w-5 h-5" />}
                color="text-amber-500"
                bg="bg-amber-500/10"
            />
            <SummaryCard 
                label="Process Time" 
                value={`${summary.elapsedSeconds.toFixed(1)}s`} 
                icon={<Clock className="w-5 h-5" />}
                color="text-purple-500"
                bg="bg-purple-500/10"
            />
        </div>

        <div 
            className="rounded-3xl p-8 flex flex-col justify-between text-white shadow-2xl relative overflow-hidden group"
            style={{ backgroundColor: 'var(--fluent-accent)', boxShadow: '0 12px 24px var(--ring-focus)' }}
        >
            <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-125 transition-transform duration-700">
                <CheckCircle2 className="w-32 h-32" />
            </div>
            <div className="relative">
                <h3 className="text-xl font-bold mb-2 text-white">Ready for Import</h3>
                <p className="text-white/80 text-sm leading-relaxed">Your photos are now optimized with internal metadata and ready for your favorite gallery app.</p>
            </div>
            <button 
                onClick={() => openOutputFolder(summary.outputPath || "")}
                className="relative mt-8 py-4 bg-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-100 transition-colors shadow-xl"
                style={{ color: 'var(--fluent-accent)' }}
            >
                <span>Open Destination</span>
                <ExternalLink className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Main Action - Process More Archives */}
      <div className="flex justify-center py-2">
        <button 
            onClick={onReset}
            className="fluent-btn-primary flex items-center gap-3 px-10 h-[44px] text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
            <RefreshCcw className="w-4 h-4" />
            <span>Process More Archives</span>
        </button>
      </div>

      {/* Collapsible Audit Log Card */}
      <div className="rounded-3xl overflow-hidden flex flex-col transition-all duration-500" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <button 
          onClick={() => setShowLogs(!showLogs)}
          className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors w-full text-left"
        >
            <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Execution Audit Log</h3>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-zinc-500/10 text-zinc-500">Secondary Info</span>
              {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
        </button>

        <AnimatePresence>
          {showLogs && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 pt-0 space-y-4 max-h-64 overflow-y-auto custom-scrollbar" style={{ borderTop: '1px solid var(--card-border)' }}>
                  <div className="flex items-center justify-between mb-4 pt-4">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Detail Metrics</span>
                    <button 
                        onClick={() => openOutputFolder(summary.logPath)}
                        className="text-[10px] uppercase tracking-widest font-bold text-blue-500 hover:underline"
                    >
                        Open Full Log File
                    </button>
                  </div>
                  <LogItem label="Total items analyzed" value={summary.totalInputFiles} />
                  <LogItem label="Unique media preserved" value={summary.processedOk} />
                  <LogItem label="Redundant copies purged" value={summary.duplicatesRemoved} />
                  <LogItem label="Undated items repaired" value={summary.undatedFiles} color="text-blue-400" />
                  <LogItem label="Raw digital formats" value={summary.rawFiles} />
                  <LogItem label="Metadata-only matches" value={summary.unmatchedSidecars} color="text-amber-500" />
                  <LogItem label="Output directory" value={summary.outputPath} isPath />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, bg }: { label: string, value: number|string, icon: React.ReactNode, color: string, bg: string }) {
    return (
        <div className="p-6 rounded-3xl flex items-center gap-6 transition-all group" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg", bg, color)}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className={cn("text-2xl font-black tracking-tight", color)} style={!color.includes('emerald') && !color.includes('amber') && !color.includes('rose') ? { color: 'var(--text-primary)' } : {}}>{value}</p>
            </div>
        </div>
    )
}

function LogItem({ label, value, color, isPath = false }: { label: string, value: any, color?: string, isPath?: boolean }) {
    return (
        <div className="flex items-center justify-between text-xs py-1">
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className={cn("font-mono font-medium", color, isPath && "truncate max-w-[300px]")} style={!color ? { color: 'var(--text-primary)' } : {}}>{value}</span>
        </div>
    )
}
