import { motion } from "framer-motion";
import { AlertCircle, ShieldAlert, ArrowRight } from "lucide-react";
import { ValidationWarning } from "../types";
import { cn } from "../lib/utils";
import { APP_CONFIG } from "../config";

interface WarningModalProps {
  warnings: ValidationWarning[];
  hasErrors: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function WarningModal({ warnings, hasErrors, onConfirm, onCancel }: WarningModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="w-full max-w-xl acrylic rounded-3xl overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 to-rose-500" />
        
        <div className="p-10">
          <div className="flex items-center gap-5 mb-8">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
              hasErrors ? "bg-rose-500 text-white shadow-rose-500/20" : "bg-amber-500 text-white shadow-amber-500/20"
            )}>
              {hasErrors ? <ShieldAlert className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
            </div>
            <div>
              <h2 id="modal-title" className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {hasErrors ? "Critical Errors" : "Engine Warnings"}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Preliminary scan found potential issues.</p>
            </div>
          </div>

          <div 
            className="rounded-2xl p-6 max-h-[300px] overflow-y-auto custom-scrollbar mb-8"
            style={{ backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid var(--card-border)' }}
          >
            <div className="space-y-4">
              {warnings.map((w, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 group-hover:scale-125 transition-transform" />
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    <span className="font-mono text-[10px] uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Issue {i+1}</span>
                    {w.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={onConfirm}
              className={cn(
                "w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 active:scale-95",
                hasErrors 
                  ? "bg-zinc-800 text-zinc-400 border border-white/5 cursor-not-allowed opacity-50" 
                  : "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40"
              )}
            >
              <span>{hasErrors ? "Errors Must Be Fixed" : "Acknowledge and Continue"}</span>
              {!hasErrors && <ArrowRight className="w-5 h-5" />}
            </button>

            <button 
              onClick={onCancel}
              className="w-full py-3 rounded-2xl font-bold text-sm bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-zinc-400 active:scale-95"
            >
              Cancel and Select Again
            </button>
            
            <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--text-muted)' }}>
              Security Protocol {APP_CONFIG.version} • {APP_CONFIG.name} Core
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
