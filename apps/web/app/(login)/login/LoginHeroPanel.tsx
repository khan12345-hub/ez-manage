/*
 * Login brand panel — "Ledger Reserve" (Phase 0, design option D).
 * Deep forest ground with a faint ledger grid, a serif headline and the three
 * products. Hidden below `lg`; the form shows its own small brand mark there.
 */

const PRODUCTS = [
  { no: "01", name: "Boards", line: "Tables, Kanban and forms for every team" },
  { no: "02", name: "Work", line: "Spaces, lists, goals and AI for projects" },
  { no: "03", name: "CEO Tower", line: "Approvals, risks and the whole portfolio" },
];

export function LoginHeroPanel() {
  return (
    <section
      aria-label="EZ Manage"
      className="relative hidden w-[56%] max-w-[860px] shrink-0 flex-col bg-forest px-14 py-12 text-forest-foreground lg:flex xl:px-[72px]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[10px] border border-brass font-serif text-xl text-brass-soft">
          EZ
        </span>
        <span className="text-base font-semibold tracking-[0.02em]">EZ Manage</span>
      </div>

      {/* Thesis */}
      <div className="flex max-w-[600px] flex-1 flex-col justify-center gap-7 py-10">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-brass-soft">
          Operating system for the agency
        </span>
        <h1 className="font-serif text-[clamp(44px,4.6vw,64px)] font-normal leading-[1.02] tracking-[-0.01em] text-white">
          One desk for every company{" "}
          <em className="italic text-brass-soft">you run.</em>
        </h1>
        <p className="max-w-[480px] text-[17px] leading-relaxed text-[#b9c8be]">
          Boards for daily operations, Work for projects, and the CEO Tower for
          what needs your decision, in one sign-in.
        </p>

        <ol className="mt-2 flex flex-col border-t border-brass/35">
          {PRODUCTS.map((p) => (
            <li
              key={p.no}
              className="flex items-baseline gap-5 border-b border-brass/35 py-3.5"
            >
              <span className="w-7 shrink-0 font-mono text-xs text-brass-soft">{p.no}</span>
              <span className="w-36 shrink-0 font-serif text-2xl text-white">{p.name}</span>
              <span className="text-[#b9c8be]">{p.line}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Trust line — only claims that are true of the product */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-[#93a89b]">
        <span>Encrypted sessions</span>
        <span>Role-based access</span>
        <span>Full audit log</span>
      </div>
    </section>
  );
}
