import { motion } from "framer-motion";
import { Download, Rocket, RefreshCw, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Update } from "@tauri-apps/plugin-updater";
import { useState } from "react";
import { installUpdate } from "../lib/updater";
import { APP_CONFIG } from "../config";

interface UpdateModalProps {
    update: Update | null;
    onClose: () => void;
}

export default function UpdateModal({ update, onClose }: UpdateModalProps) {
    const [step, setStep] = useState<'available' | 'downloading' | 'complete' | 'error'>('available');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const handleInstall = async () => {
        if (!update) return;
        setStep('downloading');
        try {
            await installUpdate(update, (p) => setProgress(p));
            setStep('complete');
        } catch (e: any) {
            setError(e.message || "Failed to install update");
            setStep('error');
        }
    };

    if (!update && step !== 'error') return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-lg acrylic rounded-[2rem] overflow-hidden relative border border-white/10 shadow-2xl"
            >
                {/* Header Decoration */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8e44ff] to-[#60a5fa] opacity-50" />
                
                <div className="p-8">
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#8e44ff]/10 flex items-center justify-center text-[#8e44ff]">
                                {step === 'available' && <Rocket className="w-6 h-6" />}
                                {step === 'downloading' && <RefreshCw className="w-6 h-6 animate-spin" />}
                                {step === 'complete' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                                {step === 'error' && <AlertCircle className="w-6 h-6 text-rose-500" />}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                    {step === 'available' && "Update Available"}
                                    {step === 'downloading' && "Downloading Update"}
                                    {step === 'complete' && "Installation Ready"}
                                    {step === 'error' && "Update Failed"}
                                </h2>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    {step === 'available' && `Version ${update?.version} is ready to install.`}
                                    {step === 'downloading' && `Preparing assets for ${APP_CONFIG.name}...`}
                                    {step === 'complete' && "All systems updated."}
                                    {(step === 'error' || !update) && "Something went wrong during the process."}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/5 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {step === 'available' && (
                            <div 
                                className="p-5 rounded-2xl bg-black/20 border border-white/5 space-y-3"
                            >
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                                    <span>Release Notes</span>
                                    <span>{update?.date}</span>
                                </div>
                                <div className="text-sm leading-relaxed max-h-[120px] overflow-y-auto custom-scrollbar pr-2" style={{ color: 'var(--text-secondary)' }}>
                                    {update?.body || "This update contains stability improvements and bug fixes."}
                                </div>
                            </div>
                        )}

                        {(step === 'downloading' || step === 'complete') && (
                            <div className="space-y-4 py-4">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                                    <span>{step === 'downloading' ? 'Download Progress' : 'Finalizing'}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-gradient-to-r from-[#8e44ff] to-[#60a5fa]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 'error' && (
                            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm italic">
                                {error || "An unknown error occurred. Please try again later or visit the official website."}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            {step === 'available' && (
                                <>
                                    <button 
                                        onClick={onClose}
                                        className="flex-1 py-4 rounded-2xl text-sm font-bold border border-white/5 hover:bg-white/5 transition-all"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Later
                                    </button>
                                    <button 
                                        onClick={handleInstall}
                                        className="flex-[2] py-4 rounded-2xl text-sm font-black bg-[#8e44ff] text-white shadow-lg shadow-[#8e44ff]/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Update Now
                                    </button>
                                </>
                            )}
                            
                            {step === 'complete' && (
                                <p className="w-full text-center text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>
                                    Relaunching {APP_CONFIG.name}...
                                </p>
                            )}

                            {(step === 'error' || !update) && (
                                <button 
                                    onClick={onClose}
                                    className="w-full py-4 rounded-2xl text-sm font-bold bg-white/5 hover:bg-white/10 transition-all"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
