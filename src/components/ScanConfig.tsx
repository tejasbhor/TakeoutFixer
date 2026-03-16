import { 
  Database, 
  Search,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Archive,
  Check
} from "lucide-react";
import { JobConfig, ValidationResult } from "../types";
import { cn } from "../lib/utils";

interface ScanConfigProps {
  validationResult: ValidationResult;
  onStart: (config: JobConfig) => void;
  config: JobConfig;
}

export default function ScanConfig({ validationResult, onStart, config }: ScanConfigProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-end mb-4">
        <button 
          onClick={() => onStart(config)}
          className="fluent-btn-primary flex items-center gap-2 px-8 h-[44px] text-sm font-bold shadow-xl transition-all hover:scale-105 active:scale-95"
        >
          <span>Run Health Check</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Summary - Compact Grid */}
      <div className="grid grid-cols-4 gap-3" role="group" aria-label="Archive Statistics">
        <StatItem 
            label="Archives" 
            value={validationResult.archives.length.toString()} 
            icon={<Archive className="w-4 h-4" />}
        />
        <StatItem 
            label="Volume" 
            value={`${validationResult.estimatedExtractedGb.toFixed(1)} GB`} 
            icon={<Database className="w-4 h-4" />}
        />
        <StatItem 
            label="Warnings" 
            value={validationResult.warnings.length.toString()} 
            color={validationResult.warnings.length > 0 ? "text-amber-500" : "text-emerald-500"}
            icon={<AlertCircle className="w-4 h-4" />}
        />
        <StatItem 
            label="Safety" 
            value={validationResult.hasErrors ? "Check" : "Clear"} 
            color={validationResult.hasErrors ? "text-rose-500" : "text-emerald-500"}
            icon={<ShieldCheck className="w-4 h-4" />}
        />
      </div>

      <div className="space-y-6">
        {/* Audit Scope */}
        <section className="fluent-card">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Search className="w-4 h-4 text-blue-500" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Audit Parameters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AuditItem label="Metadata Integrity" desc="Check JPEG/JSON internal sync" />
              <AuditItem label="Structure Check" desc="Verify ZIP health & folder tree" />
              <AuditItem label="Deduplication" desc="Identify exact binary duplicates" />
              <AuditItem label="Video Validation" desc="Cross-platform date checking" />
          </div>
        </section>

        <div className="p-4 rounded-xl border flex items-center gap-3 bg-blue-500/5 transition-opacity" style={{ borderColor: 'var(--card-border)' }}>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
                <p className="text-xs font-bold text-blue-400">Safe Execution Mode</p>
                <p className="text-[10px] text-blue-400/60 font-medium tracking-tight">This process is non-destructive. No files will be modified on your disk.</p>
            </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color?: string }) {
    return (
        <div className="p-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-medium uppercase tracking-wider leading-none mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className={cn("text-xs font-semibold", color)} style={!color ? { color: 'var(--text-primary)' } : {}}>{value}</p>
            </div>
        </div>
    )
}

function AuditItem({ label, desc }: { label: string, desc: string }) {
    return (
        <div className="p-4 rounded-xl border flex items-center gap-4 group transition-all hover:bg-white/[0.02]" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500 shadow-inner group-hover:scale-110 transition-transform">
                <Check className="w-4 h-4" />
            </div>
            <div>
                <p className="text-xs font-bold leading-none mb-1 text-zinc-200">{label}</p>
                <p className="text-[10px] text-zinc-500">{desc}</p>
            </div>
        </div>
    )
}
