import { motion } from "framer-motion";
import { 
  X, 
  Loader2, 
  FileCheck, 
  Database, 
  Wand2, 
  Image as ImageIcon,
  CheckCircle2,
  Clock
} from "lucide-react";
import { ProgressEvent } from "../types";
import { cn } from "../lib/utils";

interface PipelineProgressProps {
  progress: ProgressEvent | null;
  onCancel: () => void;
}

export default function PipelineProgress({ progress, onCancel }: PipelineProgressProps) {
  const steps = [
    { id: 1, name: "Validate", icon: FileCheck },
    { id: 2, name: "Extract", icon: Database },
    { id: 3, name: "Index", icon: Clock },
    { id: 4, name: "Flatten", icon: Wand2 },
    { id: 5, name: "Match", icon: ImageIcon },
    { id: 6, name: "Parse", icon: FileCheck },
    { id: 7, name: "Paths", icon: Database },
    { id: 8, name: "Write", icon: CheckCircle2 },
  ];

  const currentStage = progress?.stage || 1;
  const percent = progress 
    ? Math.round((Number(progress.current) / Number(progress.total)) * 100) 
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Processing Engine</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Executing 8-stage metadata repair pipeline...</p>
        </div>
        <button 
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Stage Indicators */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-12">
        {steps.map((step) => {
          const isComplete = currentStage > step.id;
          const isActive = currentStage === step.id;
          
          return (
            <div key={step.id} className="flex flex-col items-center gap-3">
              <div 
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  isComplete ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : 
                  isActive ? "bg-[#8e44ff] text-white shadow-lg shadow-[#8e44ff]/20 scale-105" : 
                  "bg-white/[0.03] border border-white/[0.05] shadow-inner"
                )}
                style={{ 
                    backgroundColor: !isActive && !isComplete ? 'var(--card-bg)' : undefined,
                    borderColor: !isActive && !isComplete ? 'var(--card-border)' : undefined,
                    color: !isActive && !isComplete ? 'var(--text-muted)' : undefined 
                }}
              >
                {isActive ? <Loader2 className="w-6 h-6 animate-spin" /> : <step.icon className="w-6 h-6" />}
              </div>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-widest",
                isActive ? "text-blue-500" : isComplete ? "text-emerald-500" : ""
              )} style={!isActive && !isComplete ? { color: 'var(--text-muted)' } : {}}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main Progress Card */}
      <div 
        className="rounded-3xl p-10 relative overflow-hidden"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="absolute top-0 left-0 w-full h-[2px]" style={{ backgroundColor: 'var(--card-border)' }}>
            <motion.div 
                className="h-full" 
                style={{ backgroundColor: 'var(--fluent-accent)' }}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
            />
        </div>

        <div className="flex justify-between items-end mb-8">
            <div>
                <p className="font-bold uppercase tracking-widest text-[11px] mb-2" style={{ color: 'var(--fluent-accent)' }}>
                    Stage {currentStage}: {progress?.stageName || "Initializing..."}
                </p>
                <h3 className="text-2xl font-bold truncate max-w-md" style={{ color: 'var(--text-primary)' }}>
                    {progress?.currentFile ? progress.currentFile : "Warming up engine..."}
                </h3>
            </div>
            <div className="text-right">
                <span className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>{percent}%</span>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
            <Counter label="Processed" count={progress?.processed || 0} unit="Files" />
            <Counter label="Duplicates" count={progress?.skipped || 0} unit="Purged" />
            <Counter label="Errors" count={progress?.errors || 0} unit="Warnings" color="text-rose-400" />
        </div>
      </div>

      {/* Detail Log Preview */}
      <div className="mt-auto pt-6 flex items-center gap-3 text-[10px] font-mono italic" style={{ color: 'var(--text-muted)' }}>
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span>Executing: {progress?.message || "Internal command sync..."}</span>
      </div>
    </div>
  );
}

function Counter({ label, count, unit, color }: { label: string, count: number|string, unit: string, color?: string }) {
    return (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <div className="flex items-baseline gap-2">
                <span className={cn("text-2xl font-bold tracking-tight", color)} style={!color ? { color: 'var(--text-primary)' } : {}}>{count}</span>
                <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{unit}</span>
            </div>
        </div>
    );
}
