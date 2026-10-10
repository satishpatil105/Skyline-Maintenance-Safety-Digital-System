import Link from "next/link";

/**
 * The branded page header, always centred: the Skyline emblem in a round
 * badge, the company name in bold, and the page title under it. Used on every
 * page so the look and sizes stay the same everywhere.
 */
export default function SiteHeader({
  title = "Maintenance & Safety Management System",
  subtitle,
  children,
  large = false,
  showNav = true,
}: {
  title?: string;
  subtitle?: React.ReactNode;
  /** Extra content under the title (e.g. a status pill). */
  children?: React.ReactNode;
  /** Bigger logo, for landing pages such as the QR scan page. */
  large?: boolean;
  showNav?: boolean;
}) {
  return (
    <header className="brand-header text-white shadow-md relative">
      {showNav && (
        <div className="border-b border-white/10 bg-black/20 backdrop-blur-xs px-4 py-2">
          <div className="mx-auto flex max-w-5xl items-center justify-between text-xs font-bold">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors"
              title="Return to Plant Overview"
            >
              <span className="text-base">🏭</span>
              <span className="tracking-wide uppercase font-extrabold text-[0.7rem] sm:text-xs">All Plant Stations</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-white hover:bg-white/30 transition-all shadow-xs ring-1 ring-white/30"
                title="Go to Administrator Station"
              >
                <span>🔒</span>
                <span className="font-black text-[0.7rem] sm:text-xs">Admin Station</span>
              </Link>

              <a
                href="/api/auth/logout"
                className="flex items-center gap-1.5 rounded-full bg-rose-600 hover:bg-rose-700 px-3 py-1 text-white transition-all shadow-xs font-black text-[0.7rem] sm:text-xs cursor-pointer"
                title="Sign out of current session"
              >
                <span>🚪</span>
                <span>Logout</span>
              </a>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 py-6 text-center">
        {/* The emblem is cropped out of the logo file (which has white margins). */}
        <span
          role="img"
          aria-label="Skyline Project & Engineers logo"
          className={`brand-badge shrink-0 rounded-full bg-white shadow-lg ring-2 ring-white/60 ${large ? "h-36 w-36 sm:h-44 sm:w-44" : "h-24 w-24 sm:h-28 sm:w-28"
            }`}
        />
        <div className="min-w-0 max-w-full">
          {/* Company name: bold, and sized to fit one or two lines on any screen. */}
          <p className="text-balance break-words text-[1.7rem] font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
            Skyline Project &amp; Engineers Pvt. Ltd.
          </p>
          <h1 className="mt-1.5 text-balance break-words text-lg font-semibold text-white/95 sm:text-xl">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 break-words text-sm text-white/85">{subtitle}</p>}
          {children}
        </div>
      </div>
    </header>
  );
}
