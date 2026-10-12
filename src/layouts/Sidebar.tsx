import { NavLink } from 'react-router-dom';
import {
  ClipboardList,
  FilePlus,
  FileStack,
  Inbox,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { paths } from '@/routes/paths';
import { clearAllRequests } from '@/services/requestRepository';
import type { Role } from '@/types';
import { APP_ROLES } from '@/types';
import { getPrimaryRoleLabel, getSwitcherRole } from '@/utils/permissions';
import { getUserInitials } from '@/utils/userDisplay';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  badgeCount?: number;
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
          isActive
            ? 'bg-sidebar-active text-white'
            : 'text-brand-100 hover:bg-sidebar-hover hover:text-white',
        ].join(' ')
      }
    >
      <span className="shrink-0 opacity-90">{item.icon}</span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badgeCount != null && item.badgeCount > 0 ? (
        <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
          {item.badgeCount}
        </span>
      ) : null}
    </NavLink>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, switchRole } = useAuth();
  const {
    pendingInboxCount,
    showActionInboxInSidebar,
    showTemplatesInSidebar,
    hasManagementSection,
  } = usePermissions();

  const workspaceItems: NavItem[] = [
    {
      to: paths.requestNew,
      label: 'New Request',
      icon: <FilePlus size={18} />,
    },
    {
      to: paths.requests,
      label: 'My Requests',
      icon: <ClipboardList size={18} />,
      end: true,
    },
  ];

  const managementItems: NavItem[] = [];

  if (showActionInboxInSidebar) {
    managementItems.push({
      to: paths.inbox,
      label: 'Action Inbox',
      icon: <Inbox size={18} />,
      badgeCount: pendingInboxCount,
    });
  }

  if (showTemplatesInSidebar) {
    managementItems.push({
      to: paths.templates,
      label: 'Templates',
      icon: <FileStack size={18} />,
      end: true,
    });
  }

  const handleClearMockRequests = () => {
    const confirmed = window.confirm(
      'Clear all mock requests stored in this browser? This cannot be undone.',
    );
    if (!confirmed) return;

    clearAllRequests();
    onClose();
    window.location.assign(paths.requests);
  };

  const handleRoleChange = (value: string) => {
    if ((APP_ROLES as readonly string[]).includes(value)) {
      switchRole(value as Role);
    }
  };

  const initials = getUserInitials(user.name);
  const switcherValue = getSwitcherRole(user) ?? 'employee';

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-white transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div>
            <div className="text-lg font-semibold tracking-wide">SATS</div>
            <div className="text-[10px] uppercase tracking-wider text-brand-300">
              Submission & Approval
            </div>
          </div>
          <button
            type="button"
            className="rounded p-1 text-brand-200 hover:bg-sidebar-hover hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
              My Workspace
            </p>
            <div className="flex flex-col gap-0.5">
              {workspaceItems.map((item) => (
                <NavItemLink key={item.to} item={item} onNavigate={onClose} />
              ))}
            </div>
          </div>

          {hasManagementSection && managementItems.length > 0 && (
            <div>
              <div className="mb-2 border-t border-white/10 pt-4">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                  Management & Approvals
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                {managementItems.map((item) => (
                  <NavItemLink key={item.to} item={item} onNavigate={onClose} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto space-y-4 border-t border-white/10 pt-4">
            <div className="px-1">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
                Dev role switcher
              </p>
              <div
                role="group"
                aria-label="Switch mock role"
                className="grid grid-cols-3 gap-1 rounded-lg bg-white/10 p-1"
              >
                {(
                  [
                    { value: 'employee', label: 'Employee' },
                    { value: 'approver', label: 'Approver' },
                    { value: 'admin', label: 'Admin' },
                  ] as const
                ).map((option) => {
                  const active = switcherValue === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleRoleChange(option.value)}
                      aria-pressed={active}
                      className={[
                        'rounded-md px-1.5 py-2 text-center text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80',
                        active
                          ? 'bg-amber-300 text-brand-950 shadow-sm'
                          : 'bg-transparent text-brand-100 hover:bg-white/10 hover:text-white',
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 px-2 text-[10px] leading-snug text-brand-400">
                Development only — production uses token-based identity.
              </p>
            </div>

            <div>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
                Dev (temporary)
              </p>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-amber-100 transition-colors hover:bg-sidebar-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                onClick={handleClearMockRequests}
              >
                <Trash2 size={18} className="shrink-0 opacity-90" aria-hidden="true" />
                Clear mock requests
              </button>
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
              aria-hidden="true"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-brand-300">{user.groupName}</p>
              <p className="truncate text-xs text-brand-400">
                {getPrimaryRoleLabel(user)}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
