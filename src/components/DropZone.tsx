import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, FolderOpen, Archive } from "lucide-react";
import { cn } from "../lib/utils";

interface DropZoneProps {
  onSelect: (paths: string[]) => void;
}

export default function DropZone({ onSelect }: DropZoneProps) {
  const [isHovering, setIsHovering] = useState(false);

  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "Archives", extensions: ["zip"] }],
      });
      if (Array.isArray(selected) && selected.length > 0) {
        onSelect(selected);
      } else if (typeof selected === "string") {
        onSelect([selected]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (typeof selected === "string") {
        onSelect([selected]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div 
        className={cn(
          "flex-1 rounded-3xl border-2 border-dashed transition-all duration-300 ease-out flex flex-col items-center justify-center p-12 text-center group relative overflow-hidden cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30",
          isHovering 
            ? "border-blue-500/40 bg-blue-500/[0.03]" 
            : "border-white/[0.08] dark:border-white/[0.08] light:border-black/[0.08] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/20 dark:hover:border-white/20 light:hover:border-black/20"
        )}
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleSelectFiles}
        onKeyDown={(e) => e.key === 'Enter' && handleSelectFiles()}
        tabIndex={0}
        role="button"
        aria-label="Upload Google Takeout ZIP files"
      >
        <div className="relative mb-8">
            <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ease-out",
                isHovering ? "bg-[#8e44ff] text-white scale-[1.05] shadow-lg shadow-[#8e44ff]/20" : "bg-white/[0.03] shadow-inner"
            )} style={{ backgroundColor: isHovering ? undefined : 'var(--card-bg)', border: '1px solid var(--card-border)', color: isHovering ? 'white' : 'var(--text-muted)' }}>
                <Upload className="w-8 h-8" />
            </div>
        </div>

        <h3 className="text-xl font-semibold mb-2 tracking-tight" style={{ color: 'var(--text-primary)' }}>Import Archives</h3>
        <p className="text-sm max-w-sm leading-relaxed mb-10" style={{ color: 'var(--text-secondary)' }}>
          Select or drop your Google Takeout <span className="font-bold opacity-80">.zip</span> bundles to begin restoration.
        </p>

        <button className="fluent-btn-primary flex items-center gap-2 text-sm shadow-xl">
            <span>Choose Files</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div 
            onClick={handleSelectFolder}
            onKeyDown={(e) => e.key === 'Enter' && handleSelectFolder()}
            tabIndex={0}
            role="button"
            className="fluent-card flex items-center gap-4 cursor-default group py-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
        >
            <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300"
                style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}
            >
                <FolderOpen className="w-5 h-5" />
            </div>
            <div className="text-left">
                <h4 className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>Direct Folder</h4>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Select an unzipped root.</p>
            </div>
        </div>

        <div className="fluent-card flex items-center gap-4 opacity-40 grayscale cursor-not-allowed py-4">
            <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}
            >
                <Archive className="w-5 h-5" />
            </div>
            <div className="text-left">
                <h4 className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>Auto Discovery</h4>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Scan connected drives.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
