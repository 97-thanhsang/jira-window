'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { JiraProject } from '@/types/jira';

interface CreateIssueModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

type IssueTypeName = 'Task' | 'Bug' | 'Story' | 'Sub-task';
type PriorityName = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';

interface StoredUser {
  name?: string;
  displayName?: string;
}

export function CreateIssueModal({ onClose, onSuccess }: CreateIssueModalProps) {
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [projectKey, setProjectKey] = useState('');
  const [issueType, setIssueType] = useState<IssueTypeName>('Task');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityName>('Medium');
  const [assignee, setAssignee] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);

  // Load projects on mount
  useEffect(() => {
    api
      .get<JiraProject[]>('/project')
      .then((r) => {
        setProjects(r.data);
        if (r.data.length > 0) {
          setProjectKey(r.data[0].key);
        }
      })
      .catch(() => {
        setError('Failed to load projects.');
      })
      .finally(() => setProjectsLoading(false));
  }, []);

  // Load current user from localStorage (useEffect to avoid SSR mismatch)
  useEffect(() => {
    setCurrentUser(getStoredUser() as StoredUser | null);
  }, []);

  function handleAssignToMe() {
    if (currentUser?.name) {
      setAssignee(currentUser.name);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Summary is required');
      return;
    }
    if (!projectKey) {
      setError('Please select a project');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const fields: Record<string, unknown> = {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary: summary.trim(),
        priority: { name: priority },
      };

      if (description.trim()) {
        fields.description = description.trim();
      }
      if (assignee.trim()) {
        fields.assignee = { name: assignee.trim() };
      }

      await api.post('/issue', { fields });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const apiErr = err as {
        response?: { data?: { errorMessages?: string[]; errors?: Record<string, string> } };
      };
      const msgs = apiErr.response?.data?.errorMessages;
      const fieldErrs = apiErr.response?.data?.errors;
      const firstFieldErr = fieldErrs ? Object.values(fieldErrs)[0] : null;
      setError(
        msgs?.[0] ?? firstFieldErr ?? 'Failed to create issue. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectClass =
    'w-full h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#172B4D]">
            Create Issue
          </h2>
          <button
            onClick={onClose}
            className="text-[#5E6C84] hover:text-[#172B4D] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project */}
          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Project <span className="text-red-500">*</span>
            </label>
            {projectsLoading ? (
              <div className="h-8 rounded-lg border border-input bg-[#F4F5F7] animate-pulse" />
            ) : (
              <select
                className={selectClass}
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.key}>
                    {p.key} — {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Issue Type */}
          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Issue Type
            </label>
            <select
              className={selectClass}
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueTypeName)}
            >
              <option value="Task">Task</option>
              <option value="Bug">Bug</option>
              <option value="Story">Story</option>
              <option value="Sub-task">Sub-task</option>
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Summary <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Issue summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Description{' '}
              <span className="text-[#5E6C84] font-normal">(optional)</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 transition-colors"
              rows={4}
              placeholder="Describe the issue…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Priority
            </label>
            <select
              className={selectClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityName)}
            >
              <option value="Highest">Highest</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Lowest">Lowest</option>
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold text-[#172B4D] mb-1">
              Assignee{' '}
              <span className="text-[#5E6C84] font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Username"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="flex-1"
              />
              {currentUser?.name && (
                <button
                  type="button"
                  onClick={handleAssignToMe}
                  className="text-xs text-[#0052CC] hover:underline whitespace-nowrap flex-shrink-0"
                >
                  Assign to me
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={isSubmitting || projectsLoading}>
              {isSubmitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Issue'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
