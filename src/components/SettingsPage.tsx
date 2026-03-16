import { 
  Monitor, 
  Shield, 
  Info, 
  Github, 
  Globe,
  MessageSquare,
  ChevronRight,
  Sparkles,
  Zap,
  Bell,
  Lock,
  Heart,
  FileText
} from "lucide-react";
import { cn } from "../lib/utils";

interface SettingsPageProps {
  theme: 'dark' | 'light' | 'auto';
  onThemeChange: (theme: 'dark' | 'light' | 'auto') => void;
  micaEnabled: boolean;
  onMicaChange: (enabled: boolean) => void;
  notifications: boolean;
  onNotificationsChange: (enabled: boolean) => void;
  hwAcceleration: boolean;
  onHwAccelerationChange: (enabled: boolean) => void;
  onNavigate: (page: any) => void;
  platform: 'windows' | 'macos' | 'linux' | 'other';
  onCheckUpdate: () => void;
  isCheckingUpdate: boolean;
}

import { APP_CONFIG } from "../config";

export default function SettingsPage({
  theme,
  onThemeChange,
  micaEnabled,
  onMicaChange,
  notifications,
  onNotificationsChange,
  hwAcceleration,
  onHwAccelerationChange,
  onNavigate,
  platform,
  onCheckUpdate,
  isCheckingUpdate
}: SettingsPageProps) {
  const isMac = platform === 'macos';
  const isWindows = platform === 'windows';

  return (
    <div className="flex flex-col h-full gap-8 max-w-3xl mx-auto">
      <div className="mb-2">
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Settings</h2>
      </div>

      <div className="space-y-10 custom-scrollbar pr-4">
        {/* Appearance Group */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#8e44ff]" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>Appearance</h3>
          </div>
          
          <div className="settings-group">
            <SettingsRow 
              icon={<Monitor className="w-4 h-4" />}
              title="App Theme"
              desc="Choose between Light, Dark, or System themes."
            >
              <div 
                className="flex p-1 rounded-lg"
                style={{ backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid var(--card-border)' }}
              >
                {(['dark', 'light', 'auto'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onThemeChange(t)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                      theme === t ? "bg-[#8e44ff] text-white shadow-lg shadow-[#8e44ff]/20" : "hover:brightness-125"
                    )}
                    style={{ color: theme === t ? '#fff' : 'var(--text-muted)' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow 
                icon={<Zap className="w-4 h-4" />} 
                title={isMac ? "Vibrancy Effect" : (isWindows ? "Mica Effect" : "Transparency")} 
                desc={isMac ? "Enable native macOS translucency." : (isWindows ? "Enable background wallpaper sampling for a native feel." : "Enable window transparency.")}
            >
              <Toggle checked={micaEnabled} onChange={() => onMicaChange(!micaEnabled)} />
            </SettingsRow>
          </div>
        </section>

        {/* System & Security Group */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-zinc-500" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>System & Security</h3>
          </div>
          
          <div className="settings-group">
            <SettingsRow 
              icon={<Bell className="w-4 h-4" />}
              title="Native Notifications"
              desc="Show Windows Action Center alerts when repair completes."
            >
              <Toggle checked={notifications} onChange={() => onNotificationsChange(!notifications)} />
            </SettingsRow>

            <SettingsRow 
              icon={<Lock className="w-4 h-4" />}
              title="Hardware Acceleration"
              desc="Use GPU for advanced backdrop filters and transparency."
            >
              <Toggle checked={hwAcceleration} onChange={() => onHwAccelerationChange(!hwAcceleration)} />
            </SettingsRow>
          </div>
        </section>

        {/* About Group */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>About</h3>
          </div>
          
          <div className="settings-group">
            <div className="p-6 flex items-center gap-6 border-b border-white/[0.05]">
                <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: 'var(--fluent-accent)', boxShadow: '0 8px 16px var(--ring-focus)' }}
                >
                    <Monitor className="w-8 h-8 text-white" />
                </div>
                <div>
                    <h4 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{APP_CONFIG.name}</h4>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Version {APP_CONFIG.version} (Build {APP_CONFIG.buildId})</p>
                    <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-500 text-[9px] font-bold uppercase tracking-wider border border-zinc-500/20 capitalize">{platform}</span>
                        {APP_CONFIG.badges.map(badge => (
                            <span 
                                key={badge.label}
                                className={cn(
                                    "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                                    badge.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                )}
                            >
                                {badge.label}
                            </span>
                        ))}
                    </div>
                </div>
                <button 
                    onClick={onCheckUpdate}
                    disabled={isCheckingUpdate}
                    className="ml-auto fluent-btn-secondary h-9 px-6 text-xs font-bold disabled:opacity-50"
                >
                    {isCheckingUpdate ? "Checking..." : "Check for Updates"}
                </button>
            </div>

            <SettingsLink icon={<Github />} title="GitHub Repository" desc="View source code and contribute." onClick={() => window.open(APP_CONFIG.links.github, '_blank')} />
            <SettingsLink icon={<Globe />} title="Official Website" desc="Documentation and support." onClick={() => window.open(APP_CONFIG.links.website, '_blank')} />
            <SettingsLink icon={<MessageSquare />} title="Feedback & Support" desc="Report issues or request features." onClick={() => window.open(APP_CONFIG.links.feedback, '_blank')} />
          </div>
        </section>

        <div className="pb-8 pt-4 flex items-center justify-center gap-4">
            <FooterLink icon={<FileText className="w-3.5 h-3.5" />} label="Terms" onClick={() => onNavigate('terms')} />
            <FooterLink icon={<Lock className="w-3.5 h-3.5" />} label="Privacy" onClick={() => onNavigate('privacy')} />
            <FooterLink icon={<Heart className="w-3.5 h-3.5" />} label="Rate app" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ icon, title, desc, children }: { icon: React.ReactNode, title: string, desc: string, children: React.ReactNode }) {
    return (
        <div className="settings-row">
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400">
                    {icon}
                </div>
                <div className="settings-label">
                    <span className="settings-title">{title}</span>
                    <span className="settings-desc">{desc}</span>
                </div>
            </div>
            {children}
        </div>
    )
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: () => void }) {
    return (
        <button 
            onClick={onChange}
            className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                checked ? "bg-[#8e44ff]" : "bg-black/20"
            )}
            style={{ border: '1px solid var(--card-border)' }}
        >
            <div className={cn(
                "absolute top-[3px] w-3 h-3 rounded-full bg-white transition-all",
                checked ? "right-[3px]" : "left-[3px]"
            )} />
        </button>
    )
}

function FooterLink({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] transition-all hover:brightness-110 active:scale-95"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}

function SettingsLink({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) {
    return (
        <div className="settings-row group cursor-pointer" onClick={onClick}>
            <div className="flex items-center gap-4">
                <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-all bg-white/5"
                    style={{ border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}
                >
                    {icon}
                </div>
                <div className="settings-label">
                    <span className="settings-title">{title}</span>
                    <span className="settings-desc">{desc}</span>
                </div>
            </div>
            <ChevronRight className="w-4 h-4 transition-colors group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} />
        </div>
    )
}
