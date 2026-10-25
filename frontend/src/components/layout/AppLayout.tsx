import {
  Activity,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  FileText,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/Provider';
import { DEMO_ACCOUNTS } from '../../data/mock/seed';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Role } from '../../types';
import { cx } from '../../utils/format';
import { Avatar, Badge, Button, Logo, ThemeToggle } from '../ui';
export const NAV: Record<Role, { path: string; label: string; icon: typeof Activity }[]> = {
  patient: [
    { path: '', label: 'Overview', icon: LayoutDashboard },
    { path: 'profile', label: 'My Profile', icon: UserRound },
    { path: 'history', label: 'Health History', icon: History },
    { path: 'assessments', label: 'Assessments', icon: ClipboardList },
    { path: 'cases', label: 'My Cases', icon: HeartPulse },
    { path: 'appointments', label: 'Appointments', icon: CalendarDays },
    { path: 'reports', label: 'Medical Reports', icon: FileText },
    { path: 'notifications', label: 'Notifications', icon: Bell },
    { path: 'settings', label: 'Settings', icon: Settings },
  ],
  doctor: [
    { path: '', label: 'Overview', icon: LayoutDashboard },
    { path: 'cases', label: 'Assigned Cases', icon: ClipboardList },
    { path: 'patients', label: 'Patient Records', icon: Users },
    { path: 'reviews', label: 'Case Reviews', icon: Stethoscope },
    { path: 'appointments', label: 'Appointments', icon: CalendarDays },
    { path: 'schedule', label: 'Schedule', icon: CalendarDays },
    { path: 'activity', label: 'Activity', icon: Activity },
    { path: 'settings', label: 'Settings', icon: Settings },
  ],
  admin: [
    { path: '', label: 'Overview', icon: LayoutDashboard },
    { path: 'users', label: 'User Management', icon: Users },
    { path: 'doctors', label: 'Doctor Management', icon: Stethoscope },
    { path: 'cases', label: 'Cases', icon: ClipboardList },
    { path: 'appointments', label: 'Appointments', icon: CalendarDays },
    { path: 'reports', label: 'Reports', icon: FileText },
    { path: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
    { path: 'audit', label: 'Audit Activity', icon: History },
    { path: 'settings', label: 'System Settings', icon: Settings },
  ],
};
export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const role = pathname.split('/')[2] as Role;
  const { state } = useDemo();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const isSmall = useMediaQuery('(max-width: 767px)');
  const asideRef = useRef<HTMLElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const nav = NAV[role] ?? NAV.patient;
  const account = DEMO_ACCOUNTS[role] ?? DEMO_ACCOUNTS.patient;
  useEffect(() => {
    setMobile(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    if (mobile) {
      wasOpen.current = true;
      asideRef.current?.querySelector<HTMLButtonElement>('.mobile-only')?.focus();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
    if (wasOpen.current && isSmall) {
      openRef.current?.focus();
      wasOpen.current = false;
    }
  }, [mobile, isSmall]);
  useEffect(() => {
    if (!isSmall) setMobile(false);
  }, [isSmall]);
  useEffect(() => {
    if (!mobile) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobile(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [mobile]);
  const active = nav.find((n) => n.path && pathname.includes('/' + n.path))?.label ?? 'Overview';
  return (
    <div className={cx('workspace', `workspace-${role}`, collapsed && 'sidebar-collapsed')}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {mobile && (
        <div className="mobile-overlay" onClick={() => setMobile(false)} aria-hidden="true" />
      )}
      <aside
        id="workspace-navigation"
        ref={asideRef}
        inert={isSmall && !mobile}
        role={isSmall ? 'dialog' : undefined}
        aria-modal={isSmall && mobile ? true : undefined}
        aria-hidden={isSmall && !mobile ? true : undefined}
        className={cx('sidebar', mobile && 'sidebar-mobile-open')}
        aria-label={`${role} navigation`}
        onKeyDown={(e) => {
          if (!mobile || e.key !== 'Tab') return;
          const elements = Array.from(
            asideRef.current?.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),select',
            ) ?? [],
          ).filter((el) => el.getClientRects().length);
          const first = elements[0],
            last = elements.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="sidebar-brand">
          <Logo small={collapsed} />
          <Button
            className="mobile-only"
            variant="ghost"
            size="icon"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </Button>
        </div>
        <div className="workspace-label">
          <span className="workspace-symbol">
            {role === 'doctor' ? (
              <Stethoscope size={17} />
            ) : role === 'admin' ? (
              <ShieldCheck size={17} />
            ) : (
              <HeartPulse size={17} />
            )}
          </span>
          <span>
            {account.label}
            <small>Fictional workspace</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <p className="nav-category">WORKSPACE</p>
        <nav>
          {nav.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={`/app/${role}${path ? '/' + path : ''}`}
              end={!path}
              title={collapsed ? label : undefined}
              className={({ isActive }) => cx('sidebar-link', isActive && 'active')}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === 'My Cases' && (
                <small>{state.cases.filter((c) => c.patientId === 'p-01').length}</small>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-orbit">
              <HeartPulse size={21} />
            </span>
            <h3>Thoughtfully connected.</h3>
            <p>Explore a more considered healthcare experience.</p>
            <Link to="/platform">
              About this prototype <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link className="sidebar-link" to="/">
            <LogOut size={19} />
            <span>Back to website</span>
          </Link>
          <Button
            variant="ghost"
            className="collapse-control"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>Collapse sidebar</span>
          </Button>
        </div>
      </aside>
      <div className="workspace-main" inert={isSmall && mobile}>
        <header className="app-topbar">
          <div className="topbar-breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
              ref={openRef}
              aria-controls="workspace-navigation"
              aria-expanded={mobile}
            >
              <Menu size={21} />
            </Button>
            <span className="desktop-only">Workspace</span>
            <span className="breadcrumb-divider desktop-only">/</span>
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <Badge tone="teal">
              <span className="status-dot" />
              Sample Data
            </Badge>
            <label className="role-select">
              <span className="sr-only">Demo role</span>
              <select value={role} onChange={(e) => navigate(`/app/${e.target.value}`)}>
                <option value="patient">Patient demo</option>
                <option value="doctor">Doctor demo</option>
                <option value="admin">Admin demo</option>
              </select>
            </label>
            <ThemeToggle />
            <Button asChild variant="ghost" size="icon">
              <Link
                to={`/app/${role}/${role === 'patient' ? 'notifications' : role === 'admin' ? 'audit' : 'activity'}`}
                aria-label="View activity"
              >
                <Bell size={18} />
              </Link>
            </Button>
            <span className="topbar-avatar">
              <Avatar name={account.name} size="sm" />
            </span>
          </div>
        </header>
        <div className="demo-ribbon">
          <ShieldCheck size={14} />
          <span>Academic prototype · Fictional records only · Changes reset on reload</span>
          <Link to="/security">
            About privacy <ArrowUpRight size={12} />
          </Link>
        </div>
        <main id="main-content" className="app-content" key={role}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>MedAssist · Built with care, designed for people.</span>
          <span>Demo clock: 25 Oct 2026 · No clinical decision support</span>
        </footer>
      </div>
    </div>
  );
}
