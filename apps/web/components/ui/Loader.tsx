interface BasicLoaderProps {
  className?: string;
}

export const BasicLoader = ({ className = "" }: BasicLoaderProps) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
};

export const FullScreenLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-background">
      {/* Subtle top progress bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
        <div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500"
          style={{ animation: "ezSlide 1.6s ease-in-out infinite" }}
        />
      </div>

      {/* Brand icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/25">
        <div className="grid h-8 w-8 grid-cols-2 gap-[3px] rotate-45">
          <div
            className="rounded-[2px] bg-[#FF3D57]"
            style={{ animation: "ezPulse 1.6s ease-in-out infinite", animationDelay: "0ms" }}
          />
          <div
            className="rounded-[2px] bg-[#00CFF4]"
            style={{ animation: "ezPulse 1.6s ease-in-out infinite", animationDelay: "200ms" }}
          />
          <div
            className="rounded-[2px] bg-[#FFCB00]"
            style={{ animation: "ezPulse 1.6s ease-in-out infinite", animationDelay: "400ms" }}
          />
          <div
            className="rounded-[2px] bg-[#00C875]"
            style={{ animation: "ezPulse 1.6s ease-in-out infinite", animationDelay: "600ms" }}
          />
        </div>
      </div>

      {/* Brand name */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-lg font-bold tracking-tight text-foreground">EzManage</p>
        <p className="text-xs text-muted-foreground/60">Loading your workspace…</p>
      </div>

      {/* Bouncing dots */}
      <div className="flex items-center gap-1.5">
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-indigo-400/60"
            style={{ animation: "ezBounce 1.2s ease-in-out infinite", animationDelay: `${delay}ms` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes ezPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes ezBounce {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50%       { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes ezSlide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(200%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};
