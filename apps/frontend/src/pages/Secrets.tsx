import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, EyeOff, Trash2, ArrowLeft, Download, Upload, Copy, Pencil, History, RotateCcw, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '../components/layout/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getProject, getEnvironments, deleteProject, Environment } from '../api/projects';
import {
  getSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
  exportSecrets,
  importSecrets,
  getSecretHistory,
  getDeletedSecrets,
  Secret,
} from '../api/secrets';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

export function Secrets() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [newSecret, setNewSecret] = useState({ key: '', value: '', description: '' });
  const [importContent, setImportContent] = useState('');
  const [editTarget, setEditTarget] = useState<Secret | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [historyTarget, setHistoryTarget] = useState<Secret | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: environments } = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => getEnvironments(projectId!),
    enabled: !!projectId,
    select: (data) => {
      if (data.length > 0 && !selectedEnv) {
        setSelectedEnv(data[0].id);
      }
      return data;
    },
  });

  const { data: secrets, isLoading } = useQuery({
    queryKey: ['secrets', selectedEnv],
    queryFn: () => getSecrets(selectedEnv!, true),
    enabled: !!selectedEnv,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['secret-history', historyTarget?.id],
    queryFn: () => getSecretHistory(historyTarget!.id),
    enabled: !!historyTarget,
  });

  const { data: deletedSecrets, isLoading: deletedLoading } = useQuery({
    queryKey: ['deleted-secrets', selectedEnv],
    queryFn: () => getDeletedSecrets(selectedEnv!),
    enabled: !!selectedEnv && showDeletedModal,
  });

  // 시크릿 생성은 항상 모든 환경(dev/staging/prod)에 반영된다
  const createSecretMutation = useMutation({
    mutationFn: async () => {
      let created = 0;
      const failed: string[] = [];
      let firstError = '';
      for (const env of environments ?? []) {
        try {
          await createSecret(env.id, newSecret.key, newSecret.value, newSecret.description);
          created++;
        } catch (error) {
          const err = error as { response?: { data?: { message?: string } } };
          if (!firstError) firstError = err.response?.data?.message || '';
          failed.push(env.name);
        }
      }
      return { created, failed, firstError };
    },
    onSuccess: ({ created, failed, firstError }) => {
      queryClient.invalidateQueries({ queryKey: ['secrets'] });
      if (created > 0) {
        setShowCreateModal(false);
        setNewSecret({ key: '', value: '', description: '' });
      }
      if (failed.length > 0) {
        toast.error(
          firstError
            ? `${firstError} (failed in ${failed.join(', ')})`
            : `Failed in ${failed.join(', ')}`
        );
      } else {
        toast.success(`Secret created in all ${created} environments`);
      }
    },
  });

  const updateSecretMutation = useMutation({
    mutationFn: ({ key, value, description }: { key: string; value?: string; description?: string }) =>
      updateSecret(selectedEnv!, key, value, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets', selectedEnv] });
      setEditTarget(null);
      toast.success('Secret updated');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update secret');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      updateSecret(selectedEnv!, key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets', selectedEnv] });
      queryClient.invalidateQueries({ queryKey: ['secret-history'] });
      toast.success('Value restored');
    },
    onError: () => {
      toast.error('Failed to restore value');
    },
  });

  // 삭제 보관함에서 시크릿을 되살린다 (현재 환경에 재생성)
  const restoreDeletedMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      createSecret(selectedEnv!, key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets', selectedEnv] });
      toast.success('Secret restored');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to restore (key may already exist)');
    },
  });

  const deleteSecretMutation = useMutation({
    mutationFn: (key: string) => deleteSecret(selectedEnv!, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets', selectedEnv] });
      queryClient.invalidateQueries({ queryKey: ['deleted-secrets', selectedEnv] });
      toast.success('Secret deleted');
    },
    onError: () => {
      toast.error('Failed to delete secret');
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => deleteProject(projectId!),
    onSuccess: () => {
      toast.success('Project deleted');
      navigate('/');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to delete project');
    },
  });

  // 임포트도 항상 모든 환경에 반영된다
  const importMutation = useMutation({
    mutationFn: async (content: string) => {
      let total = 0;
      for (const env of environments ?? []) {
        const result = await importSecrets(env.id, content);
        total += result.imported;
      }
      return { total, envCount: environments?.length ?? 0 };
    },
    onSuccess: ({ total, envCount }) => {
      queryClient.invalidateQueries({ queryKey: ['secrets'] });
      setShowImportModal(false);
      setImportContent('');
      toast.success(`Imported into all ${envCount} environments (${total} writes)`);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to import secrets');
    },
  });

  const handleExport = async () => {
    if (!selectedEnv) return;
    try {
      const content = await exportSecrets(selectedEnv);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '.env';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Secrets exported');
    } catch {
      toast.error('Failed to export secrets');
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  const handleCreateSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[A-Z][A-Z0-9_]*$/.test(newSecret.key)) {
      toast.error('Key must start with a letter and contain only A-Z, 0-9, and _ (e.g. MY_KEY_123)');
      return;
    }
    createSecretMutation.mutate();
  };

  const handleEditSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    updateSecretMutation.mutate({
      key: editTarget.key,
      value: editValue,
      description: editDescription,
    });
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importContent.trim()) {
      toast.error('Please paste your .env content');
      return;
    }
    importMutation.mutate(importContent);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const openEdit = (secret: Secret) => {
    setEditTarget(secret);
    setEditValue(secret.value ?? '');
    setEditDescription(secret.description ?? '');
  };

  const askConfirm = (state: ConfirmState) => setConfirmState(state);

  const allShown = !!secrets?.length && secrets.every((s: Secret) => showValues[s.id]);
  const toggleAllValues = () => {
    if (!secrets) return;
    const next: Record<string, boolean> = {};
    secrets.forEach((s: Secret) => {
      next[s.id] = !allShown;
    });
    setShowValues(next);
  };

  const currentEnv = environments?.find((e: Environment) => e.id === selectedEnv);

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{project?.name || 'Loading...'}</h1>
            <button
              onClick={() =>
                askConfirm({
                  title: 'Delete Project',
                  message: `Delete project "${project?.name}"?\nAll environments and secrets in it will be permanently deleted.`,
                  confirmLabel: 'Delete Project',
                  danger: true,
                  action: () => deleteProjectMutation.mutate(),
                })
              }
              className="btn btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
              disabled={deleteProjectMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              Delete Project
            </button>
          </div>
        </div>

        {/* Environment Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b">
          {environments?.map((env: Environment) => (
            <button
              key={env.id}
              onClick={() => setSelectedEnv(env.id)}
              className={`px-4 py-2 border-b-2 transition-colors ${
                selectedEnv === env.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: env.color }}
              />
              {env.name}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            {currentEnv && (
              <span>
                Showing secrets for <strong>{currentEnv.name}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!!secrets?.length && (
              <button onClick={toggleAllValues} className="btn btn-secondary flex items-center gap-2">
                {allShown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {allShown ? 'Hide All' : 'Show All'}
              </button>
            )}
            <button onClick={() => setShowDeletedModal(true)} className="btn btn-secondary flex items-center gap-2">
              <Archive className="w-4 h-4" />
              Deleted
            </button>
            <button onClick={handleExport} className="btn btn-secondary flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Export
            </button>
            <button onClick={() => setShowImportModal(true)} className="btn btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Secret
            </button>
          </div>
        </div>

        {/* Secrets Table */}
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : secrets?.length === 0 ? (
          <div className="text-center py-12 card">
            <p className="text-gray-500 mb-4">No secrets in this environment</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              Add Your First Secret
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-[26%]">Key</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-[38%]">Value</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Description</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {secrets?.map((secret: Secret) => (
                  <tr key={secret.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm truncate" title={secret.key}>{secret.key}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 min-w-0 text-sm bg-gray-100 px-2 py-1 rounded truncate">
                          {showValues[secret.id] ? secret.value : '••••••••'}
                        </code>
                        <button
                          onClick={() => setShowValues(prev => ({ ...prev, [secret.id]: !prev[secret.id] }))}
                          className="p-1 hover:bg-gray-200 rounded shrink-0"
                          title={showValues[secret.id] ? 'Hide value' : 'Show value'}
                        >
                          {showValues[secret.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(secret.value || '')}
                          className="p-1 hover:bg-gray-200 rounded shrink-0"
                          title="Copy value"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 truncate" title={secret.description || ''}>
                      {secret.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(secret)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                        title="Edit secret"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setHistoryTarget(secret)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                        title="View history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          askConfirm({
                            title: 'Delete Secret',
                            message: `Delete "${secret.key}" from ${currentEnv?.name}?\nThe last value stays visible in the Deleted archive.`,
                            confirmLabel: 'Delete',
                            danger: true,
                            action: () => deleteSecretMutation.mutate(secret.key),
                          })
                        }
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                        title="Delete secret"
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

        {/* Create Secret Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-1">Add New Secret</h2>
              <p className="text-sm text-gray-500 mb-4">
                Added to all environments: {environments?.map((e: Environment) => e.name).join(', ')}
              </p>
              <form onSubmit={handleCreateSecret}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={newSecret.key}
                    onChange={(e) => setNewSecret(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                    placeholder="API_KEY"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must start with a letter; letters, numbers, and underscores only
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <textarea
                    className="input font-mono"
                    rows={3}
                    value={newSecret.value}
                    onChange={(e) => setNewSecret(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="secret-value-here"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={newSecret.description}
                    onChange={(e) => setNewSecret(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What this secret is for"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createSecretMutation.isPending}
                  >
                    {createSecretMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Secret Modal */}
        {editTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-1">
                Edit <span className="font-mono">{editTarget.key}</span>
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Changes apply to <strong>{currentEnv?.name}</strong> only
              </p>
              <form onSubmit={handleEditSecret}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <textarea
                    className="input font-mono"
                    rows={4}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="What this secret is for"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditTarget(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updateSecretMutation.isPending}
                  >
                    {updateSecretMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* History Modal */}
        {historyTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-xl font-bold mb-1">
                History — <span className="font-mono">{historyTarget.key}</span>
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Current version: v{historyTarget.version}. Restoring creates a new version with the old value.
              </p>
              {historyLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : !history || history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No history yet — versions appear here after the value is changed.
                </div>
              ) : (
                <div className="max-h-96 overflow-auto divide-y border rounded">
                  {history.map((h) => (
                    <div key={h.id} className="p-3 flex items-start gap-3">
                      <span className="text-xs font-medium bg-gray-100 rounded-full px-2 py-1 shrink-0">
                        v{h.version}
                      </span>
                      <div className="flex-1 min-w-0">
                        <code className="block text-sm bg-gray-50 px-2 py-1 rounded break-all whitespace-pre-wrap max-h-24 overflow-auto">
                          {h.value}
                        </code>
                        <div className="text-xs text-gray-500 mt-1">
                          {h.changedByName || 'Unknown'} · {new Date(h.changedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                          title="Copy value"
                          onClick={() => copyToClipboard(h.value || '')}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                          title="Restore this value"
                          disabled={restoreMutation.isPending}
                          onClick={() =>
                            askConfirm({
                              title: 'Restore Value',
                              message: `Restore the v${h.version} value of ${historyTarget.key}?`,
                              confirmLabel: 'Restore',
                              danger: false,
                              action: () => restoreMutation.mutate({ key: historyTarget.key, value: h.value || '' }),
                            })
                          }
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-4">
                <button className="btn btn-primary" onClick={() => setHistoryTarget(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Secrets Modal */}
        {showDeletedModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-xl font-bold mb-1">Deleted Secrets — {currentEnv?.name}</h2>
              <p className="text-sm text-gray-500 mb-4">
                Secrets deleted from this environment, with their last value. Restore re-creates the secret.
              </p>
              {deletedLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : !deletedSecrets || deletedSecrets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Nothing has been deleted in this environment.</div>
              ) : (
                <div className="max-h-96 overflow-auto divide-y border rounded">
                  {deletedSecrets.map((d) => (
                    <div key={d.id} className="p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium mb-1">{d.key}</div>
                        <code className="block text-sm bg-gray-50 px-2 py-1 rounded break-all whitespace-pre-wrap max-h-24 overflow-auto">
                          {d.value}
                        </code>
                        <div className="text-xs text-gray-500 mt-1">
                          Deleted by {d.deletedByName || 'Unknown'} · {new Date(d.deletedAt).toLocaleString()} · v{d.version}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                          title="Copy value"
                          onClick={() => copyToClipboard(d.value)}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                          title="Restore secret"
                          disabled={restoreDeletedMutation.isPending}
                          onClick={() =>
                            askConfirm({
                              title: 'Restore Secret',
                              message: `Re-create "${d.key}" in ${currentEnv?.name} with its last value?`,
                              confirmLabel: 'Restore',
                              danger: false,
                              action: () => restoreDeletedMutation.mutate({ key: d.key, value: d.value }),
                            })
                          }
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-4">
                <button className="btn btn-primary" onClick={() => setShowDeletedModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Secrets Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
              <h2 className="text-xl font-bold mb-1">Import Secrets</h2>
              <p className="text-sm text-gray-500 mb-4">
                Imported into all environments: {environments?.map((e: Environment) => e.name).join(', ')}
              </p>
              <form onSubmit={handleImport}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload .env file or paste content
                  </label>
                  <input
                    type="file"
                    accept=".env,.txt"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 mb-2
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-medium
                      file:bg-primary-50 file:text-primary-700
                      hover:file:bg-primary-100"
                  />
                  <textarea
                    className="input font-mono text-sm"
                    rows={10}
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    placeholder="KEY=value
DATABASE_URL=postgres://...

or key/value on alternating lines (AWS Lambda console copy-paste):
QUEUE_URL
https://sqs.ap-northeast-2.amazonaws.com/..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supports .env format (KEY=value) and alternating key/value lines copied from the AWS
                    Lambda console. Existing keys will be updated.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportContent('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={importMutation.isPending || !importContent.trim()}
                  >
                    {importMutation.isPending ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirm Dialog (replaces native confirm) */}
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
