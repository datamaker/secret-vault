import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, EyeOff, Copy, Pencil, Trash2, Globe, Fingerprint, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '../components/layout/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useWorkspaceStore } from '../store/workspaceStore';
import {
  getCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  Credential,
  CredentialInput,
} from '../api/credentials';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

const emptyForm: CredentialInput = { name: '', url: '', username: '', password: '', notes: '' };

export function Credentials() {
  const { teamId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Credential | null>(null);
  const [form, setForm] = useState<CredentialInput>(emptyForm);
  const [shownPasswords, setShownPasswords] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials', teamId],
    queryFn: () => getCredentials(teamId!),
    enabled: !!teamId,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editTarget
        ? updateCredential(teamId!, editTarget.id, form)
        : createCredential(teamId!, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials', teamId] });
      setShowModal(false);
      setEditTarget(null);
      setForm(emptyForm);
      toast.success(editTarget ? 'Credential updated' : 'Credential created');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to save credential');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (credentialId: string) => deleteCredential(teamId!, credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials', teamId] });
      toast.success('Credential deleted');
    },
    onError: () => {
      toast.error('Failed to delete credential');
    },
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (credential: Credential) => {
    setEditTarget(credential);
    setForm({
      name: credential.name,
      url: credential.url ?? '',
      username: credential.username ?? '',
      password: '', // 비워두면 기존 비밀번호 유지
      notes: credential.notes ?? '',
    });
    setShowModal(true);
  };

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!editTarget && !form.password) {
      toast.error('Password is required');
      return;
    }
    saveMutation.mutate();
  };

  const filtered = (credentials ?? []).filter((c: Credential) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.url ?? '').toLowerCase().includes(q) ||
      (c.username ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Credentials</h1>
            <p className="text-sm text-gray-500 mt-1">
              Shared logins (ID / password / URL) for this team. Used by the Chrome extension for autofill.
            </p>
          </div>
          <button onClick={openCreate} className="btn btn-primary flex items-center gap-2" disabled={!teamId}>
            <Plus className="w-4 h-4" />
            New Credential
          </button>
        </div>

        {!!credentials?.length && (
          <div className="relative mb-4 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search by name, URL, or username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : !credentials || credentials.length === 0 ? (
          <div className="text-center py-12">
            <Fingerprint className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No credentials yet</h3>
            <p className="text-gray-500 mb-4">Add shared logins your team uses (admin consoles, SaaS accounts, ...)</p>
            <button onClick={openCreate} className="btn btn-primary">
              Add Your First Credential
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-[22%]">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-[26%]">URL</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-[20%]">Username</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Password</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500 w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((credential: Credential) => (
                  <tr key={credential.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium truncate" title={credential.name}>
                      {credential.name}
                      {credential.notes && (
                        <div className="text-xs text-gray-400 truncate" title={credential.notes}>
                          {credential.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {credential.url ? (
                        <a
                          href={credential.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-sm text-primary-600 hover:underline truncate"
                          title={credential.url}
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{credential.url}</span>
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-sm truncate" title={credential.username ?? ''}>
                          {credential.username || '-'}
                        </span>
                        {credential.username && (
                          <button
                            onClick={() => copy(credential.username!, 'Username')}
                            className="p-1 hover:bg-gray-200 rounded shrink-0"
                            title="Copy username"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 min-w-0 text-sm bg-gray-100 px-2 py-1 rounded truncate">
                          {shownPasswords[credential.id] ? credential.password : '••••••••'}
                        </code>
                        <button
                          onClick={() =>
                            setShownPasswords(prev => ({ ...prev, [credential.id]: !prev[credential.id] }))
                          }
                          className="p-1 hover:bg-gray-200 rounded shrink-0"
                          title={shownPasswords[credential.id] ? 'Hide password' : 'Show password'}
                        >
                          {shownPasswords[credential.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copy(credential.password ?? '', 'Password')}
                          className="p-1 hover:bg-gray-200 rounded shrink-0"
                          title="Copy password"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(credential)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                        title="Edit credential"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setConfirmState({
                            title: 'Delete Credential',
                            message: `Delete "${credential.name}"?`,
                            confirmLabel: 'Delete',
                            danger: true,
                            action: () => deleteMutation.mutate(credential.id),
                          })
                        }
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                        title="Delete credential"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">
                {editTarget ? `Edit ${editTarget.name}` : 'Add New Credential'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="AWS Console (shared)"
                    autoFocus
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL (optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={form.url ?? ''}
                    onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://console.aws.amazon.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The Chrome extension matches this URL's domain for autofill
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username / ID (optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={form.username ?? ''}
                    onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="admin@datasee.co.kr"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    className="input font-mono"
                    value={form.password ?? ''}
                    onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={editTarget ? 'Leave empty to keep current password' : ''}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={form.notes ?? ''}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="What this login is for"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowModal(false);
                      setEditTarget(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : editTarget ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {confirmState && (
          <ConfirmDialog
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.confirmLabel}
            danger={confirmState.danger}
            onConfirm={() => {
              confirmState.action();
              setConfirmState(null);
            }}
            onCancel={() => setConfirmState(null)}
          />
        )}
      </div>
    </Layout>
  );
}
