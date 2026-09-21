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
 * Example:
 *
 * {
 *   moduleKey: 'follow_ups',
 *   featureName: 'Follow-ups',
 *   matches: (pathname) =>
 *     pathname === '/follow-ups' ||
 *     pathname.startsWith('/follow-ups/'),
 * }
 *
 * NOTE: order matters. getModuleForPath() returns the FIRST match, so a
 * more specific route (audio_evaluation) must come before a broader one
 * that would also match it (audio matches startsWith('/audio/'), which
 * includes '/audio/evaluation/...').
 */
export const MODULE_ROUTES: ModuleRoute[] = [
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
      pathname.startsWith(
        '/audio/evaluation/',
      ),
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
      pathname.startsWith(
        '/search_history/',
      ),
  },
 
  /*
   * Future modules go HERE.
   *
   * {
   *   moduleKey: 'follow_ups',
   *   featureName: 'Follow-ups',
   *   matches: (pathname) =>
   *     pathname === '/follow-ups' ||
   *     pathname.startsWith('/follow-ups/'),
   * },
   */
]
 
export function getModuleForPath(
  pathname: string,
): ModuleRoute | null {
  return (
    MODULE_ROUTES.find((module) =>
      module.matches(pathname),
    ) ?? null
  )
}
 
export function getModuleState(
  modules: ModuleAccess[],
  moduleKey: string,
): ModuleAccess | null {
  return (
    modules.find(
      (module) =>
        module.module_key === moduleKey,
    ) ?? null
  )
}