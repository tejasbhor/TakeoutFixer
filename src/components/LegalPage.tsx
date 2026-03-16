import { ChevronLeft } from "lucide-react";
import { APP_CONFIG } from "../config";

interface LegalPageProps {
    type: 'terms' | 'privacy';
    onBack: () => void;
}

export default function LegalPage({ type, onBack }: LegalPageProps) {
    const isTerms = type === 'terms';
    
    return (
        <div className="flex flex-col h-full gap-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
                <button 
                    onClick={onBack}
                    className="p-2 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {isTerms ? "Terms of Service" : "Privacy Policy"}
                </h2>
            </div>

            <div 
                className="flex-1 p-8 rounded-3xl overflow-y-auto custom-scrollbar leading-relaxed"
                style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}
            >
                <div className="space-y-6 text-sm">
                    <section>
                        <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                            1. Introduction
                        </h3>
                        <p>
                            Welcome to {APP_CONFIG.name}. By using our desktop application, you agree to comply with and be bound by the following {isTerms ? "terms" : "privacy policy"}.
                            This tool is designed to work locally on your machine to repair Google Takeout photo archives.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                            2. Data Handling
                        </h3>
                        <p>
                            {isTerms 
                                ? `You retain full ownership of your photos. ${APP_CONFIG.name} does not upload, store, or transmit your personal media to any external servers. All processing happens 100% locally.`
                                : "We do not collect any personal data. Media processing is entirely local. No telemetry or usage data is sent without your explicit interaction (such as checking for updates or reporting a bug)."}
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                            3. {isTerms ? "No Warranty" : "Data Security"}
                        </h3>
                        <p>
                            {isTerms
                                ? "This software is provided 'as is' without warranty of any kind. While we strive for accuracy, we are not responsible for any data loss during the repair process. Always keep a backup of your original archives."
                                : "Since no data leaves your device, your privacy is protected by default. The isolation of the application from the network ensures that your sensitive photo metadata remains private."}
                        </p>
                    </section>

                    <section className="pt-8 border-t" style={{ borderColor: 'var(--card-border)' }}>
                        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)' }}>
                            Last Updated: {APP_CONFIG.buildId}
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
