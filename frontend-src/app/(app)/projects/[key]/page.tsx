'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { KanbanBoard } from '@/components/board/kanban-board';
import type { JiraIssue, JiraSearchResult } from '@/types/jira';

interface Column {
  id: string;
  label: string;
  issues: JiraIssue[];
  color: string;
  statusIds: string[];
}

function groupIntoColumns(issues: JiraIssue[]): Column[] {
  const todo: JiraIssue[] = [];
  const inProgress: JiraIssue[] = [];
  const done: JiraIssue[] = [];

  for (const issue of issues) {
    const cat = issue.fields.status.statusCategory.key;
    if (cat === 'new') todo.push(issue);
    else if (cat === 'done') done.push(issue);
    else inProgress.push(issue);
  }

  return [
    { id: 'todo', label: 'To Do', issues: todo, color: '#DFE1E6', statusIds: [] },
    { id: 'inprogress', label: 'In Progress', issues: inProgress, color: '#0052CC', statusIds: [] },
    { id: 'done', label: 'Done', issues: done, color: '#36B37E', statusIds: [] },
  ];
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const jql = `project = ${key} AND assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC`;
    api
      .get<JiraSearchResult>('/search', {
        params: { jql, maxResults: 50, fields: 'summary,status,priority,issuetype,assignee,project,updated' },
      })
      .then((r) => {
        setIssues(r.data.issues ?? []);
      })
      .catch(() => {
        setError('Failed to load project issues.');
      })
      .finally(() => setIsLoading(false));
  }, [key]);

  const columns = groupIntoColumns(issues);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 48px)' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-[#5E6C84] dark:text-gray-400">
        <Link
          href="/projects"
          className="hover:text-[#0052CC] flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={14} />
          Projects
        </Link>
        <span>/</span>
        <div className="flex items-center gap-1.5 text-[#172B4D] dark:text-gray-100 font-medium">
          <FolderOpen size={14} />
          {key}
        </div>
      </div>

      <h1 className="text-xl font-semibold text-[#172B4D] dark:text-gray-100 mb-6">
        {key} — My Open Issues
      </h1>

      {error ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <div className="flex-1">
          <KanbanBoard columns={columns} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
}
