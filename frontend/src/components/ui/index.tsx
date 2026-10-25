import * as Dialog from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ArrowRight, CircleHelp, Inbox, Moon, ShieldCheck, Sun, X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/Provider';
import { cx } from '../../utils/format';
import { Button } from './button';
export { Button };
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="MedAssist home">
      <span className="brand-mark">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M3 17h7l3-9 5 17 4-11 2 3h5" />
        </svg>
      </span>
      {!small && (
        <span>
          MedAssist<span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
export function ThemeToggle() {
  const { theme, toggleTheme } = useDemo();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </Button>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'indigo' | 'amber';
}) {
  return <span className={cx('badge', `badge-${tone}`)}>{children}</span>;
}
export function Status({ status }: { status: string }) {
  return (
    <Badge
      tone={
        ['Reviewed', 'Completed', 'Active'].includes(status)
          ? 'teal'
          : ['Assigned', 'Confirmed'].includes(status)
            ? 'indigo'
            : ['Submitted', 'Requested'].includes(status)
              ? 'amber'
              : 'neutral'
      }
    >
      <span className="status-dot" />
      {status}
    </Badge>
  );
}
export function Panel({
  children,
  className = '',
  title,
  action,
  description,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <section className={cx('panel', className)}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cx('avatar', `avatar-${size}`)} aria-hidden="true">
      {name
        .replace(/^Dr\. /, '')
        .split(' ')
        .slice(0, 2)
        .map((s) => s[0])
        .join('')}
    </span>
  );
}
export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  kind = 'info',
}: {
  children: ReactNode;
  kind?: 'info' | 'safe';
}) {
  return (
    <div className={cx('notice', `notice-${kind}`)}>
      {kind === 'safe' ? <ShieldCheck size={18} /> : <CircleHelp size={18} />}
      <div>{children}</div>
    </div>
  );
}
export function Skeleton() {
  return (
    <div aria-label="Loading demonstration workspace" role="status" className="skeleton-stack">
      <span className="sr-only">Loading demonstration workspace</span>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function DialogPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  drawer = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={cx('dialog-content', drawer && 'dialog-drawer')}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close dialog">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Tabs({
  items,
  value,
  onChange,
  children,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange}>
      <TabsPrimitive.List className="tabs" aria-label="View options">
        {items.map((item) => (
          <TabsPrimitive.Trigger key={item} className="tab" value={item}>
            {item}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      <TabsPrimitive.Content value={value}>{children}</TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}
export function LabeledSelect({
  label,
  children,
  value,
  onChange,
}: {
  label: string;
  children: ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}
export function Stat({
  label,
  value,
  detail,
  icon,
  tone = 'teal',
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className={cx('stat-icon', tone)}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}
