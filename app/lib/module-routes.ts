import type { ModuleAccess } from './api'

export interface ModuleRoute {
  moduleKey: string
  featureName: string
  matches: (pathname: string) => boolean
}

/*
 * CENTRAL FEATURE REGISTRY
 *
 * Add a new CRM module HERE only.
 *
 * NOTE: order matters. getModuleForPath() returns the FIRST match, so a
 * more specific route must appear before a broader route that also matches it.
 */
export const MODULE_ROUTES: ModuleRoute[] = [
  {
    moduleKey: 'meta_ads',
    featureName: 'Meta Ads',
    matches: (pathname) =>
      pathname === '/integrations/meta' ||
      pathname.startsWith('/integrations/meta/') ||
      pathname === '/settings/integrations/meta' ||
      pathname.startsWith('/settings/integrations/meta/') ||
      pathname === '/meta-ads' ||
      pathname.startsWith('/meta-ads/'),
  },

  {
    moduleKey: 'integrations',
    featureName: 'Integrations',
    matches: (pathname) =>
      pathname === '/integrations' ||
      pathname.startsWith('/integrations/') ||
      pathname === '/settings/integrations' ||
      pathname.startsWith('/settings/integrations/'),
  },

  {
    moduleKey: 'sales',
    featureName: 'Sales',
    matches: (pathname) =>
      pathname === '/sales-call' ||
      pathname.startsWith('/sales-call/') ||
      pathname === '/sales-scheduling' ||
      pathname.startsWith('/sales-scheduling/'),
  },

  {
    moduleKey: 'leads',
    featureName: 'Leads',
    matches: (pathname) =>
      pathname === '/leads' ||
      pathname.startsWith('/leads/'),
  },

  {
    moduleKey: 'custom_leads',
    featureName: 'Custom Lead',
    matches: (pathname) =>
      pathname === '/custom-lead' ||
      pathname.startsWith('/custom-lead/'),
  },

  {
    moduleKey: 'find_leads',
    featureName: 'Find Leads',
    matches: (pathname) =>
      pathname === '/search' ||
      pathname.startsWith('/search/'),
  },

  {
    moduleKey: 'audio_evaluation',
    featureName: 'Upload Audio',
    matches: (pathname) =>
      pathname.startsWith('/audio/evaluation/'),
  },

  {
    moduleKey: 'audio',
    featureName: 'Upload Audio',
    matches: (pathname) =>
      pathname === '/audio' ||
      pathname.startsWith('/audio/'),
  },

  {
    moduleKey: 'invoices',
    featureName: 'Invoices',
    matches: (pathname) =>
      pathname === '/invoices' ||
      pathname.startsWith('/invoices/'),
  },

  {
    moduleKey: 'search_history',
    featureName: 'Search History',
    matches: (pathname) =>
      pathname === '/search_history' ||
      pathname.startsWith('/search_history/'),
  },
]

export function getModuleForPath(
  pathname: string,
): ModuleRoute | null {
  return (
    MODULE_ROUTES.find((module) => module.matches(pathname)) ?? null
  )
}

export function getModuleState(
  modules: ModuleAccess[],
  moduleKey: string,
): ModuleAccess | null {
  return (
    modules.find((module) => module.module_key === moduleKey) ?? null
  )
}
