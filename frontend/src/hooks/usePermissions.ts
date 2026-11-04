import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { listCompletedInbox, listInbox } from '@/services/requestApi';
import {
  canCreateRequest,
  canManageTemplates,
  hasManagementSidebarSection,
  hasPermission,
  isApprover,
  showTemplatesInSidebar,
} from '@/utils/permissions';
import type { Permission } from '@/types';

/** Convenience hook wrapping centralized permission helpers for the current user. */
export function usePermissions() {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingInboxCount, setPendingInboxCount] = useState(0);
  const [hasAssignedWork, setHasAssignedWork] = useState(false);
  const [inboxReady, setInboxReady] = useState(false);

  useEffect(() => {
    if (!user || user.status !== 'Active') {
      setPendingInboxCount(0);
      setHasAssignedWork(false);
      setInboxReady(true);
      return;
    }
    let cancelled = false;
    setInboxReady(false);
    void Promise.all([listInbox(), listCompletedInbox()]).then(([pending, completed]) => {
      if (cancelled) return;
      if (!pending.ok || !completed.ok) {
        setPendingInboxCount(0);
        setHasAssignedWork(false);
        setInboxReady(true);
        return;
      }
      setPendingInboxCount(pending.data.filter((item) => item.canAct).length);
      setHasAssignedWork(pending.data.length > 0 || completed.data.length > 0);
      setInboxReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user, location.key]);

  const inboxAccess = Boolean(
    user && user.status === 'Active' && (isApprover(user) || hasAssignedWork),
  );

  const canManageTemplatesFlag = canManageTemplates(user);
  const showTemplates = showTemplatesInSidebar(user);

  const hasManagementSection = useMemo(() => {
    if (!user) return false;
    return inboxAccess || showTemplates || hasManagementSidebarSection(user);
  }, [user, inboxAccess, showTemplates]);

  return {
    user,
    can: (permission: Permission) => hasPermission(user, permission),
    canAccessInbox: inboxAccess,
    inboxReady,
    pendingInboxCount,
    showActionInboxInSidebar: inboxAccess,
    showTemplatesInSidebar: showTemplates,
    canManageTemplates: canManageTemplatesFlag,
    canCreateRequest: canCreateRequest(user),
    hasManagementSection,
  };
}
