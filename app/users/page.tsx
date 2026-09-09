'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'


interface AdminUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}


interface Team {
  team_id: string
  team_name: string
  owner_id: string
  plan: string
  member_limit: number
  search_limit: number
  searches_used: number
  team_role: 'leader' | 'member'
}


interface TeamMember {
  id: string
  member_email: string
  member_id: string | null
  role: 'leader' | 'member'
  status: string
  created_at: string
  full_name?: string | null
}


interface Invitation {
  id: string
  team_id: string
  team_name: string
  member_email: string
  status: string
  created_at: string
}


export default function UsersPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  const [isAdmin, setIsAdmin] = useState(false)

  // Admin data
  const [users, setUsers] = useState<AdminUser[]>([])

  // Team data
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])

  const [teamName, setTeamName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')

  const [creatingTeam, setCreatingTeam] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)


  useEffect(() => {
    loadPage()
  }, [])


  async function loadPage() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }


      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()


      if (profileError) {
        console.error(profileError)
        router.replace('/dashboard')
        return
      }


      if (profile?.role === 'admin') {
        setIsAdmin(true)

        await loadAdminUsers()
        setLoading(false)

        return
      }


      // Normal user
      setIsAdmin(false)

      await loadTeamData()

    } catch (error) {
      console.error('Users page error:', error)
      router.replace('/dashboard')
    } finally {
      setLoading(false)
    }
  }


  async function loadAdminUsers() {
    const {
      data,
      error,
    } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', {
        ascending: false,
      })


    if (error) {
      console.error(
        'Failed to load users:',
        error
      )

      alert(error.message)
      return
    }


    setUsers(data || [])
  }


  async function loadTeamData() {
    try {
      const teamResponse = await apiFetch(
        '/team/me'
      )

      if (!teamResponse.ok) {
        throw new Error(
          `Failed to load team: ${teamResponse.status}`
        )
      }


      const teamData =
        await teamResponse.json()


      if (
        !teamData.has_team ||
        !teamData.team
      ) {
        setTeam(null)
        setMembers([])

        await loadInvitations()

        return
      }


setTeam(teamData.team)

if (teamData.team.team_role === 'leader') {
  await loadMembers()
}

await loadInvitations()
    } catch (error) {
      console.error(
        'Failed to load team data:',
        error
      )
    }
  }


  async function loadMembers() {
    const response = await apiFetch(
      '/team/members'
    )

    if (!response.ok) {
      throw new Error(
        `Failed to load members: ${response.status}`
      )
    }

    const data = await response.json()

    setMembers(data || [])
  }


  async function loadInvitations() {
    const response = await apiFetch(
      '/team/invitations'
    )

    if (!response.ok) {
      throw new Error(
        `Failed to load invitations: ${response.status}`
      )
    }

    const data = await response.json()

    setInvitations(data || [])
  }


  async function createTeam() {
    const name = teamName.trim()

    if (!name) {
      alert('Enter a team name.')
      return
    }


    try {
      setCreatingTeam(true)

      const response = await apiFetch(
        '/team',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name,
          }),
        }
      )


      const data =
        await response.json()


      if (!response.ok) {
        throw new Error(
          data?.detail ||
          'Failed to create team.'
        )
      }


      alert(
        'Team created successfully.'
      )

      setTeamName('')

      await loadTeamData()

    } catch (error: any) {
      console.error(error)

      alert(
        error?.message ||
        'Failed to create team.'
      )

    } finally {
      setCreatingTeam(false)
    }
  }


  async function inviteMember() {
    const email = memberEmail.trim()

    if (!email) {
      alert('Enter a member email.')
      return
    }


    try {
      setSendingInvite(true)

      const response = await apiFetch(
        '/team/members',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            email,
          }),
        }
      )


      const data =
        await response.json()


      if (!response.ok) {
        const detail =
          data?.detail

        if (
          typeof detail === 'object' &&
          detail?.upgrade_required
        ) {
          alert(
            'Free member limit reached. Upgrade is required to add more members.'
          )
        } else {
          alert(
            typeof detail === 'string'
              ? detail
              : 'Failed to send invitation.'
          )
        }

        return
      }


      alert(
        'Invitation created successfully.'
      )

      setMemberEmail('')

      await loadTeamData()

    } catch (error) {
      console.error(error)

      alert(
        'Failed to send invitation.'
      )

    } finally {
      setSendingInvite(false)
    }
  }


  async function removeMember(
    membershipId: string
  ) {
    const confirmed =
      window.confirm(
        'Remove this team member?'
      )

    if (!confirmed) {
      return
    }


    try {
      const response = await apiFetch(
        `/team/members/${membershipId}`,
        {
          method: 'DELETE',
        }
      )


      const data =
        await response.json()


      if (!response.ok) {
        throw new Error(
          data?.detail ||
          'Failed to remove member.'
        )
      }


      await loadTeamData()

    } catch (error: any) {
      console.error(error)

      alert(
        error?.message ||
        'Failed to remove member.'
      )
    }
  }


  async function acceptInvitation(
    invitationId: string
  ) {
    try {
      const response =
        await apiFetch(
          `/team/invitations/${invitationId}/accept`,
          {
            method: 'POST',
          }
        )


      const data =
        await response.json()


      if (!response.ok) {
        throw new Error(
          data?.detail ||
          'Failed to accept invitation.'
        )
      }


      alert(
        'Invitation accepted.'
      )

      await loadTeamData()

    } catch (error: any) {
      console.error(error)

      alert(
        error?.message ||
        'Failed to accept invitation.'
      )
    }
  }


  async function rejectInvitation(
    invitationId: string
  ) {
    try {
      const response =
        await apiFetch(
          `/team/invitations/${invitationId}/reject`,
          {
            method: 'POST',
          }
        )


      const data =
        await response.json()


      if (!response.ok) {
        throw new Error(
          data?.detail ||
          'Failed to reject invitation.'
        )
      }


      await loadTeamData()

    } catch (error: any) {
      console.error(error)

      alert(
        error?.message ||
        'Failed to reject invitation.'
      )
    }
  }


  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 p-10">
          Loading...
        </div>
      </div>
    )
  }


  // ======================================================
  // EXISTING ADMIN USERS PAGE
  // ======================================================

  if (isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 p-10">
          <h1 className="text-3xl font-bold mb-6">
            Users Management
          </h1>


          <div className="overflow-x-auto rounded-xl">
            <table
              className="min-w-full"
              style={{
                background:
                  'var(--bg-card)',
                color:
                  'var(--text-primary)',
                border:
                  '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      'var(--bg-surface)',
                  }}
                >
                  <th className="p-4 text-left">
                    Name
                  </th>

                  <th className="p-4 text-left">
                    Email
                  </th>

                  <th className="p-4 text-left">
                    Role
                  </th>

                  <th className="p-4 text-left">
                    Status
                  </th>

                  <th className="p-4 text-left">
                    Created
                  </th>
                </tr>
              </thead>


              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="
                      hover:bg-white/5
                      transition
                    "
                  >
                    <td className="p-4">
                      {user.full_name || '-'}
                    </td>

                    <td className="p-4">
                      {user.email}
                    </td>

                    <td className="p-4">
                      {user.role}
                    </td>

                    <td className="p-4">
                      {user.is_active
                        ? 'Active'
                        : 'Disabled'}
                    </td>

                    <td className="p-4">
                      {new Date(
                        user.created_at
                      ).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }


  // ======================================================
  // NORMAL USER TEAM PAGE
  // ======================================================

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 p-10">

        <h1 className="text-3xl font-bold mb-8">
          Users
        </h1>


        {/* =================================================
            INVITATIONS
        ================================================= */}

        <div
          className="rounded-xl p-6 mb-8"
          style={{
            background:
              'var(--bg-card)',
            border:
              '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 className="text-xl font-bold mb-4">
            Invitations
          </h2>


          {invitations.length === 0 ? (
            <p
              style={{
                color:
                  'var(--text-muted)',
              }}
            >
              No pending invitations.
            </p>
          ) : (
            <div className="space-y-4">
              {invitations.map(
                (invitation) => (
                  <div
                    key={invitation.id}
                    className="
                      p-4
                      rounded-lg
                      bg-slate-800
                    "
                  >
                    <div className="font-semibold">
                      {invitation.team_name}
                    </div>

                    <div
                      className="
                        text-sm
                        mt-1
                        text-slate-400
                      "
                    >
                      Invitation received
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() =>
                          acceptInvitation(
                            invitation.id
                          )
                        }
                        className="
                          bg-green-600
                          hover:bg-green-700
                          text-white
                          px-4
                          py-2
                          rounded
                        "
                      >
                        Accept
                      </button>

                      <button
                        onClick={() =>
                          rejectInvitation(
                            invitation.id
                          )
                        }
                        className="
                          bg-red-600
                          hover:bg-red-700
                          text-white
                          px-4
                          py-2
                          rounded
                        "
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>


        {/* =================================================
            NO TEAM
        ================================================= */}

        {!team && (
          <div
            className="rounded-xl p-6"
            style={{
              background:
                'var(--bg-card)',
              border:
                '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <h2 className="text-xl font-bold mb-3">
              Create Your Team
            </h2>

            <p
              className="mb-6"
              style={{
                color:
                  'var(--text-muted)',
              }}
            >
              Create a team and become the
              team leader.
            </p>


            <div className="flex gap-3 max-w-xl">
              <input
                type="text"
                value={teamName}
                onChange={(e) =>
                  setTeamName(
                    e.target.value
                  )
                }
                placeholder="Team name"
                className="
                  flex-1
                  border
                  rounded
                  px-4
                  py-3
                  bg-slate-900
                "
              />

              <button
                onClick={createTeam}
                disabled={creatingTeam}
                className="
                  bg-blue-600
                  hover:bg-blue-700
                  disabled:opacity-50
                  text-white
                  px-5
                  py-3
                  rounded
                "
              >
                {creatingTeam
                  ? 'Creating...'
                  : 'Create Team'}
              </button>
            </div>
          </div>
        )}


        {/* =================================================
            TEAM
        ================================================= */}

        {team && (
          <>
            <div
              className="
                rounded-xl
                p-6
                mb-8
              "
              style={{
                background:
                  'var(--bg-card)',
                border:
                  '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    {team.team_name}
                  </h2>

                  <p
                    className="mt-1"
                    style={{
                      color:
                        'var(--text-muted)',
                    }}
                  >
                    Team role:{' '}
                    <span className="font-semibold">
                      {team.team_role}
                    </span>
                  </p>
                </div>

                <div className="text-right">
                  <div>
                    Plan:{' '}
                    <strong>
                      {team.plan}
                    </strong>
                  </div>

                  <div>
                    Searches:{' '}
                    <strong>
                      {team.searches_used}
                    </strong>
                    /
                    {team.search_limit}
                  </div>

                                    {team.team_role === 'leader' && (
                  <div>
                    Members:{' '}
                    <strong>
                      {members.filter(
                        (m) =>
                          m.role ===
                            'member' &&
                          (
                            m.status ===
                              'active' ||
                            m.status ===
                              'pending'
                          )
                      ).length}
                    </strong>
                    /
                    {team.member_limit}
                  </div>
                  )}
                </div>
              </div>
            </div>


            {/* =================================================
                MEMBERS
            ================================================= */}
          {team.team_role === 'leader' && (
            <div
              className="
                rounded-xl
                p-6
                mb-8
              "
              style={{
                background:
                  'var(--bg-card)',
                border:
                  '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <h2 className="text-xl font-bold mb-6">
                Team Members
              </h2>


              <div className="space-y-3">
                {members.map(
                  (member) => (
                    <div
                      key={member.id}
                      className="
                        flex
                        items-center
                        justify-between
                        p-4
                        rounded-lg
                        bg-slate-800
                      "
                    >
                      <div>
                        <div className="font-semibold">
                          {member.full_name ||
                            member.member_email}
                        </div>

                        <div
                          className="
                            text-sm
                            text-slate-400
                            mt-1
                          "
                        >
                          {member.member_email}
                        </div>

                        <div
                          className="
                            text-xs
                            text-slate-500
                            mt-1
                          "
                        >
                          {member.role} ·{' '}
                          {member.status}
                        </div>
                      </div>


                      {team.team_role ===
                        'leader' &&
                        member.role ===
                          'member' && (
                          <button
                            onClick={() =>
                              removeMember(
                                member.id
                              )
                            }
                            className="
                              bg-red-600
                              hover:bg-red-700
                              text-white
                              px-4
                              py-2
                              rounded
                            "
                          >
                            Remove
                          </button>
                        )}
                    </div>
                  )
                )}
              </div>


              {/* ===============================================
                  INVITE — LEADER ONLY
              =============================================== */}

              {team.team_role ===
                'leader' && (
                <div className="mt-8">
                  <h3 className="font-semibold mb-3">
                    Add Member
                  </h3>

                  <div className="flex gap-3 max-w-xl">
                    <input
                      type="email"
                      value={memberEmail}
                      onChange={(e) =>
                        setMemberEmail(
                          e.target.value
                        )
                      }
                      placeholder="member@example.com"
                      className="
                        flex-1
                        border
                        rounded
                        px-4
                        py-3
                        bg-slate-900
                      "
                    />

                    <button
                      onClick={inviteMember}
                      disabled={sendingInvite}
                      className="
                        bg-blue-600
                        hover:bg-blue-700
                        disabled:opacity-50
                        text-white
                        px-5
                        py-3
                        rounded
                      "
                    >
                      {sendingInvite
                        ? 'Sending...'
                        : 'Invite'}
                    </button>
                  </div>

                  <p
                    className="
                      text-sm
                      mt-3
                      text-slate-400
                    "
                  >
                    Free plan allows up to{' '}
                    {team.member_limit}{' '}
                    members.
                  </p>
                </div>
              )}
            </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}