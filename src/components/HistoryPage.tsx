import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Clock, 
    Trash2, 
    ChevronRight, 
    Folder, 
    Calendar,
    FileCheck,
    AlertCircle,
    CheckCircle2,
    ArrowUpRight,
    Search
} from 'lucide-react';
import { RunSummary } from '../types';
import { getHistory, clearHistory, openOutputFolder } from '../lib/tauri';
import { cn } from '../lib/utils';

export default function HistoryPage() {
    const [history, setHistory] = useState<RunSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null);

    useEffect(() => {
        loadHistoryData();
    }, []);

    const loadHistoryData = async () => {
        setLoading(true);
        try {
            const data = await getHistory();
            setHistory(data);
        } catch (e) {
            console.error('Failed to load history:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleClearHistory = async () => {
        if (confirm('Are you sure you want to clear your run history?')) {
            try {
                await clearHistory();
                setHistory([]);
                setSelectedRun(null);
            } catch (e) {
                console.error('Failed to clear history:', e);
            }
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Past Runs</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Review your previous photo restoration and scan results.</p>
                </div>
                {history.length > 0 && (
                    <button 
                        onClick={handleClearHistory}
                        className="p-2.5 rounded-xl hover:bg-rose-500/10 text-rose-500 transition-all group"
                        title="Clear history"
                    >
                        <Trash2 className="w-5 h-5 opacity-60 group-hover:opacity-100" />
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                        <Clock className="w-12 h-12 animate-pulse" />
                        <span className="text-sm font-medium">Retrieving logs...</span>
                    </div>
                </div>
            ) : history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 rounded-3xl bg-zinc-500/5 flex items-center justify-center mb-6 border border-zinc-500/10">
                        <Clock className="w-10 h-10 opacity-20" />
                    </div>
                    <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No History Yet</h3>
                    <p className="max-w-xs text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Processed runs will appear here for your review and reference.
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex gap-8">
                    {/* List View */}
                    <div className={cn(
                        "flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-8",
                        selectedRun && "hidden lg:block lg:flex-[0.4]"
                    )}>
                        {history.map((run, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedRun(run)}
                                className={cn(
                                    "w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 group",
                                    selectedRun === run 
                                        ? "bg-[#8e44ff]/10 border-[#8e44ff]/30 shadow-lg shadow-[#8e44ff]/5" 
                                        : "bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                    run.dryRun ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                                )}>
                                    {run.dryRun ? <Search className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                            {run.dryRun ? 'Scan Record' : 'Repair Job'}
                                        </span>
                                        <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter shrink-0 ml-4">
                                            {run.processedOk} Saved
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        <Calendar className="w-3 h-3" />
                                        <span>{formatDate(run.runDate)}</span>
                                    </div>
                                </div>
                                <ChevronRight className={cn(
                                    "w-4 h-4 transition-transform",
                                    selectedRun === run ? "translate-x-1 opacity-100" : "opacity-0 group-hover:opacity-40"
                                )} />
                            </button>
                        ))}
                    </div>

                    {/* Details View */}
                    <AnimatePresence mode="wait">
                        {selectedRun ? (
                            <motion.div 
                                key="details"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex-1 bg-white/5 rounded-3xl border border-white/5 p-8 flex flex-col h-full overflow-y-auto custom-scrollbar"
                            >
                                <div className="flex items-start justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-14 h-14 rounded-2xl flex items-center justify-center",
                                            selectedRun.dryRun ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                                        )}>
                                            {selectedRun.dryRun ? <Search className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                                {selectedRun.dryRun ? 'Scan Summary' : 'Run Details'}
                                            </h3>
                                            <p className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>
                                                {formatDate(selectedRun.runDate)}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedRun(null)}
                                        className="lg:hidden p-2 rounded-lg hover:bg-white/10"
                                    >
                                        <Trash2 className="w-5 h-5 rotate-45 transform" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <DetailTile 
                                        icon={<FileCheck className="w-4 h-4" />}
                                        label="Processed OK"
                                        value={selectedRun.processedOk}
                                        color="emerald"
                                    />
                                    <DetailTile 
                                        icon={<AlertCircle className="w-4 h-4" />}
                                        label="Errors / Skipped"
                                        value={selectedRun.errors + selectedRun.skipped}
                                        color="rose"
                                    />
                                    <DetailTile 
                                        icon={<Clock className="w-4 h-4" />}
                                        label="Duration"
                                        value={`${selectedRun.elapsedSeconds.toFixed(1)}s`}
                                        color="blue"
                                    />
                                    <DetailTile 
                                        icon={<Trash2 className="w-4 h-4" />}
                                        label="Duplicates"
                                        value={selectedRun.duplicatesRemoved}
                                        color="zinc"
                                    />
                                </div>

                                <div className="mt-auto space-y-4 pt-8 border-t border-white/5">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest opacity-40">
                                            <Folder className="w-3 h-3" />
                                            <span>Target Location</span>
                                        </div>
                                        <p className="text-xs break-all leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                            {selectedRun.outputPath || 'Analyze Only Mode'}
                                        </p>
                                    </div>

                                    {selectedRun.outputPath && (
                                        <button 
                                            onClick={() => openOutputFolder(selectedRun.outputPath)}
                                            className="w-full fluent-btn-secondary flex items-center justify-center gap-3 py-3"
                                        >
                                            <ArrowUpRight className="w-4 h-4" />
                                            <span>Open Local Folder</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <div className="hidden lg:flex flex-[0.6] items-center justify-center bg-white/[0.02] border border-dashed border-white/5 rounded-3xl p-12 text-center">
                                <div className="opacity-20 flex flex-col items-center gap-4">
                                    <Clock className="w-16 h-16" />
                                    <p className="max-w-[180px] text-sm font-medium">Select a run from the list to view detailed analytics</p>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

function DetailTile({ icon, label, value, color }: { icon: any, label: string, value: any, color: 'emerald' | 'rose' | 'blue' | 'zinc' }) {
    const colorMap = {
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        zinc: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
    };

    return (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", colorMap[color])}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">{label}</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            </div>
        </div>
    );
}
