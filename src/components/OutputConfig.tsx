import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { 
  MapPin, 
  Layout, 
  Calendar, 
  Folders, 
  ChevronRight,
  Check
} from "lucide-react";
import { JobConfig, ValidationResult } from "../types";
import { cn } from "../lib/utils";

interface OutputConfigProps {
  validationResult: ValidationResult;
  initialConfig: JobConfig;
  onStart: (config: JobConfig) => void;
}

export default function OutputConfig({ 
  validationResult, 
  initialConfig, 
  onStart
}: OutputConfigProps) {
  const [config, setConfig] = useState<JobConfig>(initialConfig);

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (typeof selected === "string") {
      setConfig({ ...config, outputPath: selected });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-end mb-4">
        <button 
          disabled={!config.outputPath}
          onClick={() => onStart(config)}
          className={cn(
            "fluent-btn-primary flex items-center gap-2 px-8 h-[44px] text-sm font-bold shadow-xl transition-all hover:scale-105 active:scale-95",
            !config.outputPath && "opacity-50 cursor-not-allowed bg-zinc-700 shadow-none grayscale scale-100"
          )}
        >
          <span>Start Full Repair</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Summary - Compact */}
      <div className="grid grid-cols-4 gap-3" role="group" aria-label="Archive Statistics">
        <StatItem 
            label="Archives" 
            value={validationResult.archives.length.toString()} 
            icon={<ArchiveSmall />}
        />
        <StatItem 
            label="Volume" 
            value={`${validationResult.estimatedExtractedGb.toFixed(1)} GB`} 
            icon={<DatabaseSmall />}
        />
        <StatItem 
            label="Warnings" 
            value={validationResult.warnings.length.toString()} 
            color={validationResult.warnings.length > 0 ? "text-amber-500" : "text-emerald-500"}
            icon={<AlertSmall />}
        />
        <StatItem 
            label="Safety" 
            value={validationResult.hasErrors ? "Check" : "Clear"} 
            color={validationResult.hasErrors ? "text-rose-500" : "text-emerald-500"}
            icon={<ShieldSmall />}
        />
      </div>

      <div className="space-y-6">
        {/* Section 1: Destination */}
        <section className="fluent-card">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Output Path</h3>
          </div>
          <div className="flex gap-2">
            <input 
              readOnly
              value={config.outputPath}
              placeholder="Select folder for repaired library..."
              className="flex-1 fluent-input h-10 text-xs"
            />
            <button onClick={handleBrowse} className="fluent-btn-secondary h-10 px-6 text-xs">
              Select...
            </button>
          </div>
        </section>

        {/* Section 2: Architecture */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Layout className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Hierarchy Mode</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <RadioItem 
              selected={config.outputMode === 'flat'}
              onClick={() => setConfig({...config, outputMode: 'flat'})}
              title="Flat"
              desc="Single folder."
              icon={<Layout className="w-4 h-4" />}
            />
            <RadioItem 
              selected={config.outputMode === 'byYearMonth'}
              onClick={() => setConfig({...config, outputMode: 'byYearMonth'})}
              title="Date Line"
              desc="YYYY / MM structures."
              icon={<Calendar className="w-4 h-4" />}
            />
            <RadioItem 
              selected={config.outputMode === 'preserveAlbums'}
              onClick={() => setConfig({...config, outputMode: 'preserveAlbums'})}
              title="Albums"
              desc="Keep Google naming."
              icon={<Folders className="w-4 h-4" />}
            />
          </div>
        </section>
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

function RadioItem({ selected, onClick, title, desc, icon }: { selected: boolean, onClick: () => void, title: string, desc: string, icon: React.ReactNode }) {
    return (
        <div 
            onClick={onClick}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
            tabIndex={0}
            role="radio"
            aria-checked={selected}
            className={cn(
                "p-4 rounded-xl border transition-all duration-300 ease-out cursor-default select-none relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50",
                selected 
                    ? "shadow-sm translate-y-[-2px]" 
                    : "hover:bg-white/[0.04] dark:hover:bg-white/[0.04] hover:brightness-110"
            )}
            style={{ 
                backgroundColor: selected ? 'var(--ring-focus)' : 'var(--card-bg)',
                borderColor: selected ? 'var(--fluent-accent)' : 'var(--card-border)'
            }}
        >
            <div className="mb-3 transition-colors duration-300" style={{ color: selected ? 'var(--fluent-accent)' : 'var(--text-muted)' }}>
                {icon}
            </div>
            <h4 className="font-medium text-xs mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h4>
            <p className="text-[10px] leading-normal" style={{ color: 'var(--text-muted)' }}>{desc}</p>
            
            {selected && (
                <div 
                    className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center text-white scale-90"
                    style={{ backgroundColor: 'var(--fluent-accent)' }}
                >
                    <Check className="w-2.5 h-2.5" />
                </div>
            )}
        </div>
    )
}

// Small Helper Icons
const ArchiveSmall = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>;
const DatabaseSmall = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
const AlertSmall = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const ShieldSmall = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
