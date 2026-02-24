"use client";
import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  /** Breadcrumb trail. Last item is the current page (no href needed). */
  breadcrumbs?: BreadcrumbItem[];
  /** Right-aligned action area */
  actions?: ReactNode;
  /** Status message (success/error feedback) */
  statusMessage?: { text: string; ok: boolean } | null;
  /** Show a back button. If omitted, uses breadcrumb's parent href */
  onBack?: () => void;
}

/**
 * Sticky page header with breadcrumb navigation and right-aligned actions.
 *
 * Usage:
 *   <PageHeader
 *     breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Incidents" }]}
 *     actions={<button className="nav-btn">Run Detection</button>}
 *   />
 */
export function PageHeader({ breadcrumbs = [], actions, statusMessage, onBack }: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (breadcrumbs.length >= 2) {
      const parent = breadcrumbs[breadcrumbs.length - 2];
      if (parent.href) router.push(parent.href);
    }
  };

  const hasBack = onBack != null || (breadcrumbs.length >= 2 && breadcrumbs[breadcrumbs.length - 2].href);

  return (
    <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-800 bg-[#0d1117] sticky top-0 z-30">
      {/* Back button */}
      {hasBack && (
        <>
          <button
            onClick={handleBack}
            className="nav-btn focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-0"
            aria-label={`Go back to ${breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2].label : "previous page"}`}
          >
            <ArrowLeft className="w-3 h-3" />
            <span className="hidden sm:inline">
              {breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2].label : "Back"}
            </span>
          </button>
          <div className="w-px h-4 bg-gray-700 shrink-0" />
        </>
      )}

      {/* Breadcrumb trail */}
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs min-w-0" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-gray-600 shrink-0">/</span>}
                {isLast ? (
                  <span className="font-semibold text-white truncate" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    onClick={() => crumb.href && router.push(crumb.href)}
                    className="text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:text-cyan-400"
                  >
                    {crumb.label}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {/* Right side: status message + actions */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {statusMessage && (
          <span
            className={`text-xs px-3 py-1 rounded-lg font-medium max-w-xs truncate ${
              statusMessage.ok
                ? "text-green-300 bg-green-900/40 border border-green-800/60"
                : "text-red-300 bg-red-900/40 border border-red-800/60"
            }`}
            title={statusMessage.text}
          >
            {statusMessage.text}
          </span>
        )}
        {actions}
      </div>
    </header>
  );
}
