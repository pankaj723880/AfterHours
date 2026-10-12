import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Shield, 
  UserCheck, 
  UserX, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  Info
} from 'lucide-react';

export default function UserManagement({ token, backendUrl, currentUser, showToast }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected user for modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newRole, setNewRole] = useState('user');
  const [newStatus, setNewStatus] = useState('active');
  const [isSaving, setIsSaving] = useState(false);

  // Deactivate confirmation modal
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search.trim()) queryParams.set('search', search.trim());
      if (roleFilter) queryParams.set('role', roleFilter);
      if (statusFilter) queryParams.set('status', statusFilter);

      const res = await fetch(`${backendUrl}/api/admin/users?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');

      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message);
      showToast?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setNewStatus(user.status);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: newRole,
          status: newStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showToast?.('User updated successfully', 'success');
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/users/${deactivateTarget.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deactivate user');

      showToast?.('User successfully deactivated', 'success');
      setDeactivateTarget(null);
      fetchUsers();
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Registered Accounts
              <span className="text-xs font-mono font-medium bg-neutral-800 text-emerald-400 px-2 py-0.5 rounded-full">
                {total} total
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Role-Based Access Control and server-side paginated user management
            </p>
          </div>

          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-3 pt-2 border-t border-neutral-800/80">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-emerald-500/50 rounded-xl pl-9 pr-20 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-[11px] transition cursor-pointer"
            >
              Search
            </button>
          </form>

          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="bg-neutral-950/80 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500/50"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-neutral-950/80 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500/50"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Activity Stats</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-neutral-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-neutral-500">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrent = currentUser?.userId === u.id || currentUser?.username === u.username;
                  return (
                    <tr key={u.id} className="hover:bg-neutral-800/25 transition">
                      {/* Username */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {u.username}
                          {isCurrent && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono">ID: {u.id.slice(-8)}</div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          u.role === 'admin'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/20'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}>
                          <Shield className="w-3 h-3" />
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          u.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : u.status === 'suspended'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}>
                          {u.status}
                        </span>
                      </td>

                      {/* Music Library Stats */}
                      <td className="py-3 px-4 text-[11px] text-neutral-400">
                        <span>{u.stats?.likedSongsCount || 0} likes</span> • 
                        <span className="ml-1">{u.stats?.playlistsCount || 0} playlists</span>
                      </td>

                      {/* Last Login Date */}
                      <td className="py-3 px-4 text-neutral-400 text-[11px]">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
                            title="Edit role and status"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeactivateTarget(u)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 transition"
                            title="Deactivate account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <div>
            Showing Page <span className="text-white font-semibold">{page}</span> of{' '}
            <span className="text-white font-semibold">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-neutral-300 px-2">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Role / Status Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Modify User Role & Status
            </h4>

            <div className="text-xs text-neutral-400">
              Account: <span className="font-semibold text-white">{selectedUser.username}</span>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Assigned Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="user">User (Standard privilege)</option>
                  <option value="admin">Admin (Full administrative dashboard access)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Account Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended (Login blocked)</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={isSaving}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold py-2 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="text-center">
              <h4 className="text-base font-bold text-white mb-1">Deactivate Account?</h4>
              <p className="text-xs text-neutral-400">
                Are you sure you want to deactivate <span className="font-semibold text-white">{deactivateTarget.username}</span>?
                The user will be immediately blocked from signing in. Safeguards prevent deactivating the last active admin.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeactivateTarget(null)}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-2 rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeactivate}
                disabled={isSaving}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs transition shadow-lg shadow-red-600/20"
              >
                {isSaving ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
