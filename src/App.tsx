import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  History, 
  LayoutDashboard, 
  XCircle,
  ArrowRight,
  ChevronLeft,
  MessageSquareShare,
  Github as GithubIcon,
  Loader2,
  FileSearch,
  Search,
  CheckCircle2
} from "lucide-react";
import Logomark from "./assets/logo.png";
import { JobConfig, ProgressEvent, RunSummary, ValidationResult } from "./types";
import { validateInput, startProcessing, cancelProcessing } from "./lib/tauri";
import { 
  isPermissionGranted, 
  requestPermission, 
  sendNotification 
} from '@tauri-apps/plugin-notification';
import { cn } from "./lib/utils";

// Components
import DropZone from "./components/DropZone";
import OutputConfig from "./components/OutputConfig";
import ScanConfig from "./components/ScanConfig";
import PipelineProgress from "./components/PipelineProgress";
import RunSummaryView from "./components/RunSummary";
import ScanSummary from "./components/ScanSummary";
import WarningModal from "./components/WarningModal";
import SettingsPage from "./components/SettingsPage";
import LegalPage from "./components/LegalPage";
import UpdateModal from "./components/UpdateModal";
import HistoryPage from "./components/HistoryPage";
import { APP_CONFIG } from "./config";
import { getUpdateMetadata } from "./lib/updater";
import { Update } from "@tauri-apps/plugin-updater";

type AppState = "idle" | "configuring" | "validating" | "processing" | "complete" | "error" | "settings" | "terms" | "privacy" | "history";

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [workflow, setWorkflow] = useState<'repair' | 'analysis'>('repair');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>('dark');
  const [micaEnabled, setMicaEnabled] = useState(true);
  const [platform, setPlatform] = useState<'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'other'>('windows');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) setPlatform('android');
    else if (userAgent.includes('iphone') || userAgent.includes('ipad')) setPlatform('ios');
    else if (userAgent.includes('win')) setPlatform('windows');
    else if (userAgent.includes('mac')) setPlatform('macos');
    else if (userAgent.includes('linux')) setPlatform('linux');
    else setPlatform('other');

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [notifications, setNotifications] = useState(true);
  const [hwAcceleration, setHwAcceleration] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [jobConfig, setJobConfig] = useState<JobConfig>({
    inputPaths: [],
    outputPath: "",
    outputMode: "flat",
    duplicateAction: "moveToFolder",
    dryRun: false,
    hwAcceleration: true,
  });
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  // Theme Management
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>(
    theme === 'auto' 
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (theme as 'dark' | 'light')
  );

  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
        setEffectiveTheme(e.matches ? 'dark' : 'light');
      };
      updateTheme(mediaQuery);
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    } else {
      setEffectiveTheme(theme as 'dark' | 'light');
    }
  }, [theme]);

  // Check for updates on mount
  useEffect(() => {
    handleCheckUpdate(false);
  }, []);

  // Listen for progress events from Rust
  useEffect(() => {
    let unlisten: () => void;
    async function setupListener() {
      unlisten = await listen<ProgressEvent>("progress", (event) => {
        setProgress(event.payload);
      });
    }
    setupListener();
    return () => { if (unlisten) unlisten(); };
  }, []);

  const handleInputSelected = async (paths: string[]) => {
    setAppState("validating");
    try {
      const res = await validateInput(paths);
      setValidationResult(res);
      setJobConfig(prev => ({ ...prev, inputPaths: paths }));
      
      if (res.warnings.length > 0) {
        setShowWarning(true);
      } else if (res.hasErrors) {
        setAppState("error");
        setErrorMsg("Validation failed. Check the selected files.");
      } else {
        setAppState("configuring");
      }
    } catch (e: any) {
      setAppState("error");
      setErrorMsg(e.toString());
    }
  };

  const handleConfirmWarning = () => {
    setShowWarning(false);
    if (!validationResult?.hasErrors) {
      setAppState("configuring");
    }
  };

  const handleCancelWarning = () => {
    setShowWarning(false);
    setAppState("idle");
    setValidationResult(null);
  };

  const handleStartProcessing = async (config: JobConfig) => {
    const finalConfig = { ...config, hwAcceleration: hwAcceleration };
    setJobConfig(finalConfig);
    setAppState("processing");
    setProgress(null);
    try {
      const summary = await startProcessing(finalConfig);
      setRunSummary(summary);
      setAppState("complete");
      
      // Native Windows Notification
      if (notifications) {
        const hasPermission = await isPermissionGranted();
        if (hasPermission) {
          sendNotification({ title: APP_CONFIG.name, body: 'Repair process completed successfully!' });
        } else {
          const permission = await requestPermission();
          if (permission === 'granted') {
            sendNotification({ title: APP_CONFIG.name, body: 'Repair process completed successfully!' });
          }
        }
      }
    } catch (e: any) {
      if (e.toString().includes("cancelled")) {
        setAppState("idle");
      } else {
        setAppState("error");
        setErrorMsg(e.toString());
      }
    }
  };

  const handleCancel = async () => {
    await cancelProcessing();
    setAppState("idle");
  };

  const handleCheckUpdate = async (manual: boolean) => {
    try {
      if (manual) setIsCheckingUpdate(true);
      
      // Artificial delay for better UX and to prevent glitching if response is instant
      await new Promise(r => setTimeout(r, 800));
      
      const update = await getUpdateMetadata();
      if (update) {
        setAvailableUpdate(update);
      } else if (manual) {
        sendNotification({
          title: "System Update",
          body: 'You are on the latest version.'
        });
      }
    } catch (error) {
      console.error('Update check failed:', error);
      if (manual) {
        sendNotification({
          title: "Update Error",
          body: 'Unable to connect to the update server. Please check your connection.'
        });
      }
    } finally {
      if (manual) setIsCheckingUpdate(false);
    }
  };

  const resetJob = (newWorkflow: 'repair' | 'analysis' = 'repair') => {
    setAppState("idle");
    setWorkflow(newWorkflow);
    setValidationResult(null);
    setProgress(null);
    setRunSummary(null);
    setErrorMsg(null);
    setJobConfig({
      inputPaths: [],
      outputPath: "",
      outputMode: "flat",
      duplicateAction: "moveToFolder",
      dryRun: newWorkflow === 'analysis',
      hwAcceleration: hwAcceleration,
    });
  };

  return (
    <div 
        data-theme={effectiveTheme}
        data-mica={micaEnabled ? "true" : "false"}
        className={cn(
            "h-screen w-screen flex overflow-hidden font-sans transition-all duration-500",
            effectiveTheme === 'dark' ? "dark" : "light",
            micaEnabled ? "bg-transparent" : (effectiveTheme === 'dark' ? "bg-[#0a0b0e]" : "bg-[#f8fafc]"),
            !hwAcceleration && "hw-accel-off"
        )}
    >
      {/* Platform-specific Navigation: Sidebar (Desktop) or Bottom Bar (Mobile) */}
      {!isMobile && (
        <nav className={cn(
          "h-full flex flex-col z-20 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sidebar-material",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
        <div className={cn(
            "pt-5 px-4 mb-8 flex transition-all duration-300",
            sidebarCollapsed ? "justify-center" : "items-center gap-3"
        )}>
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
                "rounded-xl flex items-center justify-center shadow-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 transition-all duration-300 hover:scale-105 active:scale-95 group hover:border-[#8e44ff]/30 hover:shadow-[#8e44ff]/10",
                sidebarCollapsed ? "w-10 h-10" : "w-8 h-8"
            )}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <img src={Logomark} alt="Logo" className="w-[75%] h-[75%] object-contain transition-transform duration-500 group-hover:rotate-12" />
          </button>
          
          {!sidebarCollapsed && (
            <div className="overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
              <h1 className="font-extrabold text-[11px] leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{APP_CONFIG.name}</h1>
              <p className="text-[7.5px] uppercase tracking-[0.2em] text-zinc-500 font-bold truncate opacity-60">Metadata Sync</p>
            </div>
          )}
        </div>

        <div className="space-y-1 flex-1 px-3">
          <button 
            onClick={() => appState !== 'processing' && resetJob('repair')}
            className={cn("nav-item w-full outline-none", (appState !== 'settings' && workflow === 'repair') && "active")}
            aria-label="New repair process"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">Repair Library</span>}
          </button>

          <button 
            onClick={() => appState !== 'processing' && resetJob('analysis')}
            className={cn("nav-item w-full outline-none", (appState !== 'settings' && workflow === 'analysis') && "active")}
            aria-label="Scan and preview"
          >
            <Search className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">Scan & Preview</span>}
          </button>
          
          <button 
            onClick={() => appState !== 'processing' && setAppState('history')}
            className={cn("nav-item w-full outline-none", (appState === 'history') && "active")}
            aria-label="Past runs history"
          >
            <History className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">Past Runs</span>}
          </button>
        </div>

        <div className="mt-auto py-4 px-3 space-y-1">
          <button 
            className="nav-item w-full group outline-none"
            title="Give feedback"
          >
            <MessageSquareShare className="w-4 h-4 shrink-0 transition-colors" style={{ color: 'var(--text-muted)' }} />
            {!sidebarCollapsed && <span className="text-sm">Feedback</span>}
          </button>

          <button 
            onClick={() => setAppState("settings")}
            className={cn("nav-item w-full group outline-none", appState === 'settings' && "active")}
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-500 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">Settings</span>}
          </button>
          
          <div className={cn(
            "flex items-center justify-between pt-4 opacity-50 px-3",
            sidebarCollapsed && "justify-center px-0"
          )} style={{ borderTop: '1px solid var(--card-border)' }}>
            {!sidebarCollapsed ? (
                <>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Edition {APP_CONFIG.edition}</span>
                    <div className="flex gap-2">
                        <GithubIcon 
                          onClick={() => window.open(APP_CONFIG.links.github, '_blank')}
                          className="w-3 h-3 cursor-pointer transition-colors hover:text-white" 
                          style={{ color: 'var(--text-muted)' }} 
                        />
                    </div>
                </>
            ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
            )}
          </div>
        </div>
      </nav>
      )}

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-900/90 backdrop-blur-xl border-t border-white/5 z-50 flex items-center justify-around px-2">
            <MobileNavItem 
                active={appState !== 'settings' && workflow === 'repair'} 
                onClick={() => appState !== 'processing' && resetJob('repair')}
                icon={<LayoutDashboard className="w-5 h-5" />}
                label="Repair"
            />
            <MobileNavItem 
                active={appState !== 'settings' && workflow === 'analysis'} 
                onClick={() => appState !== 'processing' && resetJob('analysis')}
                icon={<Search className="w-5 h-5" />}
                label="Scan"
            />
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#8e44ff] shadow-lg shadow-[#8e44ff]/30 -translate-y-4 border-4 border-zinc-900">
                <img src={Logomark} alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <MobileNavItem 
                active={appState === 'history'} 
                onClick={() => setAppState("history")}
                icon={<History className="w-5 h-5" />}
                label="History"
            />
            <MobileNavItem 
                active={appState === 'settings'} 
                onClick={() => setAppState("settings")}
                icon={<Settings className="w-5 h-5" />}
                label="Setup"
            />
        </nav>
      )}

      {/* Main Content Area - Mica Base */}
      <main className="flex-1 h-full flex flex-col relative transition-all duration-500 main-material">
        {/* Native Toolbar Area */}
        <div className="h-14 w-full flex items-center justify-between px-8 border-b border-white/5">
          <div className="flex items-center gap-4">
            <AnimatePresence>
              {(appState === "configuring" || appState === "complete" || appState === "error" || appState === "settings") && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => resetJob(workflow)}
                  className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-all group"
                  title="Back"
                >
                  <ChevronLeft className="w-6 h-6 group-active:scale-90 transition-transform" />
                </motion.button>
              )}
            </AnimatePresence>
            <div className="flex flex-col">
              {isMobile && appState === 'idle' && (
                <div className="flex items-center gap-2 mb-0.5">
                   <img src={Logomark} alt="TF" className="w-3.5 h-3.5 object-contain" />
                   <span className="text-[10px] font-black uppercase tracking-wider text-[#8e44ff]">TakeoutFixer</span>
                </div>
              )}
              <h2 className="text-sm font-bold capitalize leading-none" style={{ color: 'var(--text-primary)' }}>
                {appState === 'idle' ? (workflow === 'analysis' ? 'Scan Health' : 'Start Repair') : 
                 appState === 'configuring' ? (workflow === 'analysis' ? 'Scan Options' : 'Configure') : 
                 appState === 'processing' ? (workflow === 'analysis' ? 'Scanning' : 'Processing') : 
                 appState === 'complete' ? 'Success' : 
                 appState === 'settings' ? 'Settings' :
                 appState === 'history' ? 'Run History' :
                 appState === 'error' ? 'System Error' : appState}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {/* Dynamic Primary Actions will be synced via state or passed down */}
             <AnimatePresence>
               {appState === 'idle' && (
                  <div 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: 'var(--card-bg)', color: 'var(--fluent-accent)', border: '1px solid var(--card-border)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--fluent-accent)' }} />
                    Waiting for archives
                  </div>
               )}
             </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-6xl mx-auto h-full">
                <AnimatePresence mode="wait">
            {appState === "idle" && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="h-full flex flex-col"
              >
                <div className="mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
                    {workflow === 'analysis' ? 'Scan Health' : 'Initialize Repair'}
                  </h2>
                  <p className="text-sm md:text-base opacity-70" style={{ color: 'var(--text-secondary)' }}>
                    {workflow === 'analysis' 
                      ? 'Scan your archives to find issues before repairing.' 
                      : 'Provide your Google Takeout .zip bundles to begin.'}
                  </p>
                </div>
                <div className="flex-1 min-h-[400px]">
                  <DropZone onSelect={handleInputSelected} />
                </div>
              </motion.div>
            )}

            {appState === "validating" && (
              <motion.div 
                key="validating"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full flex flex-col items-center justify-center text-center font-sans"
              >
                <div className="mb-6">
                  <Loader2 className="w-12 h-12 animate-spin opacity-50" style={{ color: 'var(--fluent-accent)' }} />
                </div>
                <h2 className="text-xl font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Verifying Integrity</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Scanning segments and matching sidecars...</p>
              </motion.div>
            )}

            {appState === "configuring" && validationResult && (
              <motion.div 
                key="configuring"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="h-full"
              >
                <div className="mb-10 flex items-start justify-between">
                  <div>
                    <div className="flex items-baseline gap-4 mb-2">
                      <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        {workflow === 'analysis' ? 'Scan Options' : 'Configure Pipeline'}
                      </h2>
                      <div className="flex items-center gap-2 text-emerald-500 opacity-80 font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5">
                        <FileSearch className="w-3 h-3" />
                        <span>Inputs Scanned</span>
                      </div>
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {workflow === 'analysis' 
                        ? 'Review archive statistics and set your simulation preferences.' 
                        : 'Review archive statistics and set your output preferences.'}
                    </p>
                  </div>
                </div>
                {workflow === 'analysis' ? (
                  <ScanConfig 
                    key="config-scan"
                    validationResult={validationResult} 
                    config={jobConfig}
                    onStart={handleStartProcessing}
                  />
                ) : (
                  <OutputConfig 
                    key="config-repair"
                    validationResult={validationResult} 
                    initialConfig={jobConfig}
                    onStart={handleStartProcessing} 
                  />
                )}
              </motion.div>
            )}

            {appState === "processing" && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full"
              >
                <PipelineProgress progress={progress} onCancel={handleCancel} />
              </motion.div>
            )}

            {appState === "complete" && runSummary && (
              <motion.div 
                key="complete"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full"
              >
                {workflow === 'analysis' ? (
                  <ScanSummary summary={runSummary} onReset={() => resetJob('repair')} />
                ) : (
                  <>
                    <div className="mb-10">
                      <div className="flex items-center gap-3 text-emerald-500 mb-2">
                        <CheckCircle2 className="w-8 h-8 opacity-80" />
                        <h2 className="text-3xl font-bold tracking-tight">Process Concluded</h2>
                      </div>
                      <p style={{ color: 'var(--text-secondary)' }}>Your Google Takeout archive has been successfully restored.</p>
                    </div>
                    <RunSummaryView summary={runSummary} onReset={() => resetJob('repair')} />
                  </>
                )}
              </motion.div>
            )}

             {appState === "settings" && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="h-full"
              >
                <SettingsPage 
                    theme={theme}
                    onThemeChange={setTheme}
                    micaEnabled={micaEnabled}
                    onMicaChange={setMicaEnabled}
                    notifications={notifications}
                    onNotificationsChange={setNotifications}
                    hwAcceleration={hwAcceleration}
                    onHwAccelerationChange={setHwAcceleration}
                    onNavigate={(page: AppState) => setAppState(page)}
                    platform={platform}
                    onCheckUpdate={() => handleCheckUpdate(true)}
                    isCheckingUpdate={isCheckingUpdate}
                />
              </motion.div>
            )}

            {appState === "history" && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full"
              >
                <HistoryPage />
              </motion.div>
            )}

            {(appState === "terms" || appState === "privacy") && (
              <motion.div 
                key={appState}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full"
              >
                <LegalPage type={appState} onBack={() => setAppState("settings")} />
              </motion.div>
            )}

            {appState === "error" && (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6 text-rose-500">
                  <XCircle className="w-8 h-8 opacity-60" />
                </div>
                <h2 className="text-xl font-bold mb-3">System Exception</h2>
                <div className="bg-rose-500/[0.03] border border-rose-500/10 px-6 py-3 rounded-lg mb-8 max-w-md">
                  <p className="text-rose-400 font-mono text-xs">{errorMsg}</p>
                </div>
                <button onClick={() => resetJob(workflow)} className="fluent-btn-secondary flex items-center gap-2 text-sm">
                  <span>Back to Start</span>
                  <ArrowRight className="w-4 h-4 opacity-50" />
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>

      {/* Modals Layer */}
      <AnimatePresence>
        {showWarning && validationResult && (
          <WarningModal 
            warnings={validationResult.warnings} 
            hasErrors={validationResult.hasErrors}
            onConfirm={handleConfirmWarning} 
            onCancel={handleCancelWarning}
          />
        )}
        {availableUpdate && (
          <UpdateModal 
            update={availableUpdate} 
            onClose={() => setAvailableUpdate(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileNavItem({ active, onClick, icon, label, disabled = false }: { active: boolean, onClick?: () => void, icon: React.ReactNode, label: string, disabled?: boolean }) {
    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "flex flex-col items-center gap-1 transition-all",
                active ? "text-[#8e44ff]" : "text-zinc-500",
                disabled && "opacity-20 grayscale"
            )}
        >
            <div className={cn(
                "p-1.5 rounded-lg transition-all",
                active && "bg-[#8e44ff]/10"
            )}>
                {icon}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
        </button>
    );
}
