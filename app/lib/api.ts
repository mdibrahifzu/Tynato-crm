import { supabase } from './supabase'

/* =========================================================
   API FETCH
   ========================================================= */

export async function apiFetch(
  path: string,
  options: RequestInit = {},
) {
  const { data, error } =
    await supabase.auth.getSession()

  if (error) {
    console.error(
      'Failed to get session:',
      error,
    )

    const message = error.message.toLowerCase()
    const isInvalidRefreshToken =
      message.includes('invalid refresh token') ||
      message.includes('refresh token not found') ||
      message.includes('refresh token')

    if (isInvalidRefreshToken) {
      await supabase.auth.signOut({
        scope: 'local',
      })

      if (typeof window !== 'undefined') {
        window.location.replace('/login')
      }
    }

    throw error
  }

  const token =
    data.session?.access_token

  if (!token) {
    if (typeof window !== 'undefined') {
      window.location.replace('/login')
    }

    throw new Error('Not authenticated')
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:8000'

  const res = await fetch(
    `${baseUrl}${path}`,
    {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (res.status === 401) {
    await supabase.auth.signOut({
      scope: 'local',
    })

    if (typeof window !== 'undefined') {
      window.location.replace('/login')
    }

    throw new Error('Session expired')
  }

  return res
}


/* =========================================================
   COMMON RESPONSE PARSER
   ========================================================= */

export async function parseApiResponse<T>(
  res: Response,
): Promise<T> {
  if (!res.ok) {
    let message =
      `Request failed (${res.status})`

    try {
      const body = await res.json()

      if (
        typeof body?.detail === 'string'
      ) {
        message = body.detail
      } else if (
        body?.detail &&
        typeof body.detail === 'object'
      ) {
        if (
          typeof body.detail.message === 'string'
        ) {
          message = body.detail.message
        }
      }
    } catch {
      // Keep default error message.
    }

    throw new Error(message)
  }

  return res.json() as Promise<T>
}


/* =========================================================
   SUPER ADMIN TYPES
   ========================================================= */

export interface SuperAdminDashboard {
  organizations: {
    total: number
    active: number
    suspended: number
  }
  users: number
  super_admins: number
}


export interface Organization {
  id: string
  name: string
  owner_id: string
  owner_name: string | null
  owner_email: string | null
  plan: string | null
  status: 'active' | 'suspended'
  member_limit: number | null
  search_limit: number | null
  searches_used: number | null
  created_at: string
}


/* =========================================================
   MODULE ACCESS
   ========================================================= */

export interface ModuleAccess {
  module_key: string
  module_name: string

  /**
   * Global/default module availability.
   */
  global_enabled: boolean

  /**
   * Organization-specific override.
   *
   * null  = inherit global
   * true  = explicitly enabled
   * false = explicitly disabled
   */
  organization_override: boolean | null

  /**
   * Final calculated access.
   */
  effective_enabled: boolean

  /**
   * Present when the user belongs to an organization.
   */
  team_id?: string | null
}


export async function getMyModuleAccess(): Promise<ModuleAccess[]> {
  const res = await apiFetch(
    '/modules/access',
  )

  return parseApiResponse<ModuleAccess[]>(
    res,
  )
}


/* =========================================================
   MODULE SETTINGS
   ========================================================= */

export interface ModuleSetting {
  id?: string

  module_key: string
  module_name: string

  /**
   * Used by the global module settings API.
   */
  is_enabled?: boolean

  /**
   * Global availability.
   */
  global_enabled?: boolean

  /**
   * Organization override.
   *
   * null  = inherit global
   * true  = enable
   * false = disable
   */
  access_override?: boolean | null

  /**
   * Final access for the organization.
   */
  effective_enabled?: boolean

  created_at?: string
  updated_at?: string
}


export interface OrganizationModuleSetting {
  module_key: string
  module_name: string
  global_enabled: boolean
  organization_override: boolean | null
  effective_enabled: boolean
}


/* =========================================================
   ORGANIZATION MODULE RESPONSE
   ========================================================= */

export interface OrganizationModulesResponse {
  team_id: string
  team_name: string
  team_status: 'active' | 'suspended'
  modules: OrganizationModuleSetting[]
}


/* =========================================================
   PLATFORM USERS
   ========================================================= */

export interface PlatformUser {
  id: string
  email: string | null
  full_name: string | null
  role: string
  platform_role: 'user' | 'super_admin'
  is_active: boolean
  subscription_tier: string
  created_at: string
}


/* =========================================================
   AUDIT LOGS
   ========================================================= */

export interface AuditLog {
  id: string
  actor_user_id: string
  actor_email: string | null
  action: string
  target_type: string
  target_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}


/* =========================================================
   SUPER ADMIN ACCESS
   ========================================================= */

export async function superAdminAccessCheck() {
  const res = await apiFetch(
    '/super-admin/access-check',
  )

  return parseApiResponse<{
    success: boolean
    message: string
    user_id: string
    email: string
    platform_role: 'user' | 'super_admin'
  }>(res)
}


/* =========================================================
   SUPER ADMIN DASHBOARD
   ========================================================= */

export async function getSuperAdminDashboard() {
  const res = await apiFetch(
    '/super-admin/dashboard',
  )

  return parseApiResponse<SuperAdminDashboard>(
    res,
  )
}


/* =========================================================
   ORGANIZATIONS
   ========================================================= */

export async function getOrganizations(
  search = '',
) {
  const query = search.trim()
    ? `?search=${encodeURIComponent(
        search.trim(),
      )}`
    : ''

  const res = await apiFetch(
    `/super-admin/organizations${query}`,
  )

  return parseApiResponse<Organization[]>(
    res,
  )
}


export async function getOrganization(
  teamId: string,
): Promise<Organization> {
  const res = await apiFetch(
    `/super-admin/organizations/${encodeURIComponent(
      teamId,
    )}`,
  )

  return parseApiResponse<Organization>(
    res,
  )
}


export async function updateOrganizationStatus(
  teamId: string,
  status: 'active' | 'suspended',
) {
  const res = await apiFetch(
    `/super-admin/organizations/${encodeURIComponent(
      teamId,
    )}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
      }),
    },
  )

  return parseApiResponse<Organization>(
    res,
  )
}


/* =========================================================
   GLOBAL MODULES
   ========================================================= */

export async function getGlobalModules() {
  const res = await apiFetch(
    '/super-admin/modules',
  )

  return parseApiResponse<ModuleSetting[]>(
    res,
  )
}


export async function updateGlobalModule(
  moduleKey: string,
  isEnabled: boolean,
) {
  const res = await apiFetch(
    `/super-admin/modules/${encodeURIComponent(
      moduleKey,
    )}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_enabled: isEnabled,
      }),
    },
  )

  return parseApiResponse<ModuleSetting>(
    res,
  )
}


/* =========================================================
   ORGANIZATION MODULES
   ========================================================= */

/**
 * Get all module permissions for one organization.
 *
 * Response:
 * {
 *   team_id,
 *   team_name,
 *   team_status,
 *   modules: [...]
 * }
 */
export async function getOrganizationModules(
  teamId: string,
): Promise<OrganizationModulesResponse> {
  const res = await apiFetch(
    `/super-admin/organizations/${encodeURIComponent(
      teamId,
    )}/modules`,
  )

  return parseApiResponse<OrganizationModulesResponse>(
    res,
  )
}


/**
 * Update organization-specific module access.
 *
 * null  = inherit global
 * true  = explicitly enable
 * false = explicitly disable
 */
export async function updateOrganizationModule(
  teamId: string,
  moduleKey: string,
  accessOverride: boolean | null,
) {
  const res = await apiFetch(
    `/super-admin/organizations/${encodeURIComponent(
      teamId,
    )}/modules/${encodeURIComponent(
      moduleKey,
    )}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_override: accessOverride,
      }),
    },
  )

  return parseApiResponse<{
    success: boolean
    team_id: string
    module_key: string
    module_name: string
    global_enabled: boolean
    access_override: boolean | null
    effective_enabled: boolean
  }>(res)
}


/* =========================================================
   PLATFORM USERS
   ========================================================= */

export async function getPlatformUsers(
  search = '',
) {
  const query = search.trim()
    ? `?search=${encodeURIComponent(
        search.trim(),
      )}`
    : ''

  const res = await apiFetch(
    `/super-admin/users${query}`,
  )

  return parseApiResponse<PlatformUser[]>(
    res,
  )
}


/* =========================================================
   AUDIT LOGS
   ========================================================= */

export async function getAuditLogs(
  limit = 100,
  offset = 0,
) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })

  const res = await apiFetch(
    `/super-admin/audit-logs?${params.toString()}`,
  )

  return parseApiResponse<AuditLog[]>(res)
}