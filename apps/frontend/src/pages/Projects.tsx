import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '../components/layout/Layout';
import { SearchBox } from '../components/SearchBox';
import { useWorkspaceStore } from '../store/workspaceStore';
import { getProjects, createProject, updateProject, Project } from '../api/projects';

// 워크스페이스 홈: 선택된 팀의 프로젝트 목록
export function Projects() {
  const { teamId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [search, setSearch] = useState('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', teamId],
    queryFn: () => getProjects(teamId!),
    enabled: !!teamId,
  });

  const createProjectMutation = useMutation({
    mutationFn: () => createProject(teamId!, newProject.name, newProject.description || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] });
      setShowCreateModal(false);
      setNewProject({ name: '', description: '' });
      toast.success('Project created successfully');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to create project');
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: () => updateProject(editTarget!.id, editForm.name, editForm.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] });
      queryClient.invalidateQueries({ queryKey: ['project', editTarget?.id] });
      setEditTarget(null);
      toast.success('Project updated');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to update project');
    },
  });

  const filtered = (projects ?? []).filter((p: Project) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
  });

  const openEdit = (project: Project) => {
    setEditTarget(project);
    setEditForm({ name: project.name, description: project.description ?? '' });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            {!!projects?.length && (
              <p className="text-sm text-gray-500 mt-1">{projects.length} projects</p>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
            disabled={!teamId}
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {!!projects?.length && (
          <SearchBox value={search} onChange={setSearch} placeholder="Search projects" className="mb-4" />
        )}

        {!teamId ? (
          <div className="text-center py-12 text-gray-500">
            Create a team first using the + button in the sidebar.
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : projects?.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-4">Create a project to start managing secrets</p>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-[26%]">Project</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Description</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-32">Environments</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-28">Secrets</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500 w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((project: Project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/projects/${project.id}`}
                        className="flex items-center gap-2 font-medium text-primary-600 hover:underline truncate"
                        title={project.name}
                      >
                        <FolderOpen className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 truncate" title={project.description || ''}>
                      {project.description || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{project.environmentCount ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{project.secretCount ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(project)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                        title="Rename / edit description"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Create New Project</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newProject.name.trim()) createProjectMutation.mutate();
                }}
              >
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    className="input"
                    value={newProject.name}
                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="cacheby-backend"
                    autoFocus
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={newProject.description}
                    onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What this project is for"
                  />
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Environments created automatically: Local, Development, Staging, Production
                </p>
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
                    disabled={createProjectMutation.isPending}
                  >
                    {createProjectMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Project Modal */}
        {editTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Edit Project</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editForm.name.trim()) updateProjectMutation.mutate();
                }}
              >
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    className="input"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    className="input"
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What this project is for"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updateProjectMutation.isPending}
                  >
                    {updateProjectMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
