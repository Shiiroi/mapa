import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

export const INLINE_LINK_CLASS = "text-accent underline hover:text-accent-dark transition-colors";
export const INLINE_CODE_CLASS = "border border-border-light bg-surface px-1.5 py-0.5 font-mono text-xs text-primary rounded-none";

const NAV_ITEMS = [
    { to: "/", label: "Map", end: true },
    { to: "/faq", label: "FAQ", end: false },
    { to: "/privacy", label: "Privacy", end: false },
    { to: "/terms", label: "Terms", end: false },
] as const;

const SOCIAL_LINKS = [
    {
        href: "https://www.facebook.com/share/16LuySJAGLA/?mibextid=wwXIfr",
        label: "mapaPH Facebook",
        title: "mapaPH on Facebook",
        icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                    fillRule="evenodd"
                    d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                    clipRule="evenodd"
                />
            </svg>
        ),
    },
    {
        href: "https://www.instagram.com/mapaph.1030/",
        label: "mapaPH Instagram",
        title: "mapaPH on Instagram",
        icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                    fillRule="evenodd"
                    d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                    clipRule="evenodd"
                />
            </svg>
        ),
    },
    {
        href: "https://github.com/Shiiroi/mapa",
        label: "GitHub Repository",
        title: "GitHub Repository",
        icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
            </svg>
        ),
    },
] as const;

export interface HeaderLink {
    href: string;
    label: string;
    external?: boolean;
}

export interface TocItem {
    id: string;
    index: string;
    label: string;
}

export interface PageShellProps {
    breadcrumb: string;
    eyebrow: string;
    meta?: string;
    title: string;
    description: ReactNode;
    headerLink?: HeaderLink;
    children: ReactNode;
}

/**
 * Shared sharp, square document layout matching the main Lens map sidebar theme.
 */
export function PageShell({
    breadcrumb,
    eyebrow,
    meta,
    title,
    description,
    headerLink,
    children,
}: PageShellProps) {
    return (
        <div className="h-full overflow-y-auto bg-surface text-primary">
            <div className="sticky top-0 z-20 border-b border-border bg-white">
                <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-2.5 lg:px-8">
                    <Link
                        to="/"
                        className="flex shrink-0 items-center gap-2.5 outline-none transition-opacity hover:opacity-90"
                    >
                        <span className="hidden text-sm font-normal text-muted sm:inline">
                            Data, seen through the <span className="font-black uppercase text-accent">LENS</span>
                        </span>
                        <img src="/lens.png" className="h-6 w-auto" alt="Lens Logo" />
                    </Link>

                    <div className="flex items-center gap-3">
                        <nav
                            aria-label="Primary pages"
                            className="flex items-stretch border border-border bg-surface p-0.5 rounded-none"
                        >
                            {NAV_ITEMS.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-none transition-colors ${
                                            isActive
                                                ? "bg-accent text-white"
                                                : "text-primary hover:bg-white hover:text-primary"
                                        }`
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>

                        <div className="hidden items-center gap-2 border-l border-border-light pl-3 md:flex">
                            {SOCIAL_LINKS.map((item) => (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted transition-colors hover:text-accent"
                                    aria-label={item.label}
                                    title={item.title}
                                >
                                    {item.icon}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-white px-4 py-2 text-xs rounded-none">
                    <div className="flex items-center gap-1.5">
                        <Link to="/" className="font-semibold text-accent hover:text-accent-dark hover:underline">
                            Philippines
                        </Link>
                        <span className="font-mono font-bold text-slate-300" aria-hidden="true">
                            &rsaquo;
                        </span>
                        <span className="font-bold uppercase tracking-wider text-primary">{breadcrumb}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {headerLink && (
                            <a
                                href={headerLink.href}
                                target={headerLink.external ? "_blank" : undefined}
                                rel={headerLink.external ? "noopener noreferrer" : undefined}
                                className="border border-border bg-surface px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent transition-colors hover:bg-white hover:text-accent-dark rounded-none"
                            >
                                {headerLink.label} &rarr;
                            </a>
                        )}
                        <Link
                            to="/"
                            className="border border-border bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-surface rounded-none"
                        >
                            &larr; Back to Map
                        </Link>
                    </div>
                </div>

                <header className="border border-border border-l-4 border-l-accent bg-white rounded-none">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light bg-surface px-5 py-2.5 lg:px-6">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                            {eyebrow}
                        </span>
                        {meta && <span className="font-mono text-[11px] text-muted">{meta}</span>}
                    </div>
                    <div className="p-5 lg:p-6">
                        <h1 className="text-2xl font-bold tracking-tight text-primary lg:text-3xl">{title}</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted lg:text-[15px] lg:leading-7">
                            {description}
                        </p>
                    </div>
                </header>

                {children}

                <footer className="mt-2 border border-border bg-white px-5 py-4 rounded-none">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-0.5">
                            <div className="text-xs font-bold uppercase tracking-wider text-primary">
                                Lens <span className="font-normal text-muted">by mapaPH</span>
                            </div>
                            <p className="text-[11px] text-muted">
                                Open-source Philippine geospatial visualization utility (MIT License · Public Domain Datasets).
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-muted">
                            <Link to="/" className="transition-colors hover:text-accent">
                                Map
                            </Link>
                            <Link to="/faq" className="transition-colors hover:text-accent">
                                FAQ
                            </Link>
                            <Link to="/privacy" className="transition-colors hover:text-accent">
                                Privacy Policy
                            </Link>
                            <Link to="/terms" className="transition-colors hover:text-accent">
                                Terms of Service
                            </Link>
                            <a
                                href="https://www.mapaph.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors hover:text-accent"
                            >
                                mapaPH Hub
                            </a>
                            <a
                                href="https://github.com/Shiiroi/mapa"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors hover:text-accent"
                            >
                                GitHub
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export interface PageIndexProps {
    title?: string;
    items: TocItem[];
    headerSlot?: ReactNode;
    toolbarSlot?: ReactNode;
}

/**
 * Square table-of-contents directory block for quick section navigation.
 */
export function PageIndex({ title = "Contents", items, headerSlot, toolbarSlot }: PageIndexProps) {
    return (
        <nav aria-label={title} className="border border-border bg-white rounded-none">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light bg-surface px-5 py-2.5 lg:px-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{title}</span>
                {headerSlot ?? (
                    <span className="font-mono text-[11px] text-muted">{items.length} sections</span>
                )}
            </div>
            {toolbarSlot && (
                <div className="border-b border-border-light bg-white px-4 py-3 lg:px-5">{toolbarSlot}</div>
            )}
            {items.length > 0 && (
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:p-5">
                    {items.map((item) => (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            className="group flex items-start gap-2.5 border border-border-light bg-surface px-3 py-2 text-xs transition-colors hover:border-accent hover:bg-white rounded-none"
                        >
                            <span className="shrink-0 font-mono text-[11px] font-bold text-accent">{item.index}</span>
                            <span className="font-medium leading-snug text-primary transition-colors group-hover:text-accent">
                                {item.label}
                            </span>
                        </a>
                    ))}
                </div>
            )}
        </nav>
    );
}

export interface PageSectionProps {
    id?: string;
    index?: string;
    title: string;
    children: ReactNode;
}

/**
 * Uniform square content section with surface title header strip and sharp border.
 */
export function PageSection({ id, index, title, children }: PageSectionProps) {
    return (
        <section id={id} className="scroll-mt-20 border border-border bg-white rounded-none">
            <div className="flex items-center gap-3 border-b border-border-light bg-surface px-5 py-3 lg:px-6">
                {index && (
                    <span className="shrink-0 border border-border bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent rounded-none">
                        {index}
                    </span>
                )}
                <h2 className="text-sm font-bold tracking-tight text-primary lg:text-base">{title}</h2>
            </div>
            <div className="p-5 text-sm leading-6 text-muted lg:px-6 lg:py-5">{children}</div>
        </section>
    );
}
