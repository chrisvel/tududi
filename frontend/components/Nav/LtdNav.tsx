// Life-to-Day (T-304): six primary destinations + mobile bottom bar.
// Existing pages stay reachable via the desktop sidebar or "More".
import React, { useEffect, useState } from 'react';
// LTD-PATCH(T-406): custom active paths include weekly planning; use explicit accessible link state.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarDaysIcon,
    InboxIcon,
    FlagIcon,
    GlobeAltIcon,
    ClipboardDocumentListIcon,
    BookOpenIcon,
    PlusIcon,
    EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import { openCapture } from '../../utils/captureUi';

export const PRIMARY_DESTINATIONS = [
    { id: 'today', path: '/today', shortcut: 't', icon: CalendarDaysIcon },
    {
        id: 'plan',
        path: '/today/plan',
        shortcut: 'p',
        icon: ClipboardDocumentListIcon,
    },
    { id: 'goals', path: '/goals', shortcut: 'g', icon: FlagIcon },
    { id: 'life', path: '/life', shortcut: 'l', icon: GlobeAltIcon },
    { id: 'inbox', path: '/inbox', shortcut: 'i', icon: InboxIcon },
    { id: 'review', path: '/review', shortcut: 'r', icon: BookOpenIcon },
] as const;

const MORE_LINKS = [
    { id: 'settings', path: '/profile' },
    { id: 'habits', path: '/habits' },
    { id: 'notes', path: '/notes' },
    { id: 'areas', path: '/areas' },
    { id: 'projects', path: '/projects' },
] as const;

const isTypingTarget = (el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    if (el.closest('[contenteditable="true"], [contenteditable=""]')) {
        return true;
    }
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const isActivePath = (pathname: string, path: string): boolean => {
    if (path === '/today') return pathname === '/today';
    // LTD-PATCH(T-406): day and week share the same planning destination.
    if (path === '/today/plan' && pathname.startsWith('/plan/')) return true;
    return pathname === path || pathname.startsWith(`${path}/`);
};

const LtdNav: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [moreOpen, setMoreOpen] = useState(false);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (isTypingTarget(event.target)) return;
            const key = event.key.toLowerCase();
            const dest = PRIMARY_DESTINATIONS.find((d) => d.shortcut === key);
            if (!dest) return;
            event.preventDefault();
            navigate(dest.path);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [navigate]);

    useEffect(() => {
        setMoreOpen(false);
    }, [location.pathname]);

    const label = (id: string) => t(`navigation.ltd.${id}`, id);

    return (
        <>
            {/* Desktop: six destinations. Sidebar still holds Settings etc. */}
            <nav
                data-testid="ltd-nav-desktop"
                aria-label={t('navigation.ltd.primary', 'Primary')}
                className="hidden lg:flex items-center gap-1 px-3 py-1.5 border-b border-[var(--ltd-nav-border)] bg-[var(--ltd-nav-bg)]"
            >
                {PRIMARY_DESTINATIONS.map((dest) => {
                    const Icon = dest.icon;
                    const active = isActivePath(location.pathname, dest.path);
                    return (
                        <Link
                            key={dest.id}
                            to={dest.path}
                            data-testid={`ltd-nav-${dest.id}`}
                            aria-current={active ? 'page' : undefined}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
                                active
                                    ? 'bg-[var(--ltd-nav-active)] text-[var(--ltd-nav-active-ink)]'
                                    : 'text-[var(--ltd-nav-ink)] hover:bg-[var(--ltd-nav-hover)]'
                            }`}
                        >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {label(dest.id)}
                            <kbd className="ms-1 text-[10px] uppercase">
                                {dest.shortcut}
                            </kbd>
                        </Link>
                    );
                })}
            </nav>

            {/* Mobile: Today, Plan, Capture, Goals, More */}
            <nav
                data-testid="ltd-nav-mobile"
                aria-label={t('navigation.ltd.primary', 'Primary')}
                className="lg:hidden fixed inset-x-0 bottom-0 z-[10090] flex items-end justify-around px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] border-t border-[var(--ltd-nav-border)] bg-[var(--ltd-nav-bg)]"
            >
                <MobileLink
                    to="/today"
                    testId="ltd-nav-mobile-today"
                    active={isActivePath(location.pathname, '/today')}
                    label={label('today')}
                    icon={CalendarDaysIcon}
                />
                <MobileLink
                    to="/today/plan"
                    testId="ltd-nav-mobile-plan"
                    active={isActivePath(location.pathname, '/today/plan')}
                    label={label('plan')}
                    icon={ClipboardDocumentListIcon}
                />
                <button
                    type="button"
                    data-testid="ltd-nav-capture"
                    onClick={() => openCapture('inbox')}
                    className="-mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ltd-nav-capture)] text-[var(--ltd-nav-capture-ink)] shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    aria-label={t('capture.add', 'Add')}
                >
                    <PlusIcon className="h-6 w-6" aria-hidden="true" />
                </button>
                <MobileLink
                    to="/goals"
                    testId="ltd-nav-mobile-goals"
                    active={isActivePath(location.pathname, '/goals')}
                    label={label('goals')}
                    icon={FlagIcon}
                />
                <div className="relative">
                    <button
                        type="button"
                        data-testid="ltd-nav-more"
                        aria-expanded={moreOpen}
                        onClick={() => setMoreOpen((v) => !v)}
                        className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] ${
                            moreOpen
                                ? 'text-[var(--ltd-nav-active-ink)]'
                                : 'text-[var(--ltd-nav-ink)]'
                        }`}
                    >
                        <EllipsisHorizontalIcon
                            className="h-6 w-6"
                            aria-hidden="true"
                        />
                        {label('more')}
                    </button>
                    {moreOpen && (
                        <div
                            data-testid="ltd-nav-more-menu"
                            className="absolute end-0 bottom-12 min-w-[10rem] rounded-md border border-[var(--ltd-nav-border)] bg-[var(--ltd-nav-bg)] py-1 shadow-lg"
                        >
                            <Link
                                to="/life"
                                data-testid="ltd-nav-more-life"
                                className="block px-3 py-2 text-sm text-[var(--ltd-nav-ink)]"
                            >
                                {label('life')}
                            </Link>
                            <Link
                                to="/inbox"
                                data-testid="ltd-nav-more-inbox"
                                className="block px-3 py-2 text-sm text-[var(--ltd-nav-ink)]"
                            >
                                {label('inbox')}
                            </Link>
                            <Link
                                to="/review"
                                data-testid="ltd-nav-more-review"
                                className="block px-3 py-2 text-sm text-[var(--ltd-nav-ink)]"
                            >
                                {label('review')}
                            </Link>
                            {MORE_LINKS.map((link) => (
                                <Link
                                    key={link.id}
                                    to={link.path}
                                    data-testid={`ltd-nav-more-${link.id}`}
                                    className="block px-3 py-2 text-sm text-[var(--ltd-nav-ink)]"
                                >
                                    {label(link.id)}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </nav>
        </>
    );
};

const MobileLink: React.FC<{
    to: string;
    testId: string;
    active: boolean;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = ({ to, testId, active, label, icon: Icon }) => (
    <Link
        to={to}
        data-testid={testId}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] ${
            active
                ? 'text-[var(--ltd-nav-active-ink)]'
                : 'text-[var(--ltd-nav-ink)]'
        }`}
    >
        <Icon className="h-6 w-6" aria-hidden="true" />
        {label}
    </Link>
);

export default LtdNav;
