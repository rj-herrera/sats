import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  canAccessActionInbox,
  countActionableInboxItems,
} from '@/services/inboxService';
import {
  canCreateRequest,
  canManageTemplates,
  hasManagementSidebarSection,
  hasPermission,
  showTemplatesInSidebar,
} from '@/utils/permissions';
import type { Permission } from '@/types';

/** Convenience hook wrapping centralized permission helpers for the current user. */
export function usePermissions() {
  const { user } = useAuth();
  const location = useLocation();

  const inboxAccess = useMemo(
    () => canAccessActionInbox(user),
    [user, location.key],
  );

  const pendingInboxCount = useMemo(() => {
    if (!user || !inboxAccess) return 0;
    return countActionableInboxItems(user.id);
  }, [user, location.key, inboxAccess]);

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
    pendingInboxCount,
    showActionInboxInSidebar: inboxAccess,
    showTemplatesInSidebar: showTemplates,
    canManageTemplates: canManageTemplatesFlag,
    canCreateRequest: canCreateRequest(user),
    hasManagementSection,
  };
}
