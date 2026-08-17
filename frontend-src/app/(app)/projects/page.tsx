'use client';

import { useRouter } from 'next/navigation';
import { FolderOpen, Layers } from 'lucide-react';
import { useProjects } from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/skeleton';
import type { JiraProject } from '@/types/jira';

function ProjectCard({ project }: { project: JiraProject }) {
  const router = useRouter();
  const initials = project.key.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={() => router.push(`/projects/${project.key}`)}
      className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 hover:border-[#0052CC] dark:hover:border-blue-500 hover:shadow-sm transition-all text-left group"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded bg-[#0052CC] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#172B4D] dark:text-gray-100 truncate group-hover:text-[#0052CC] transition-colors">
          {project.name}
        </p>
        <p className="text-xs text-[#5E6C84] dark:text-gray-400 mt-0.5 truncate">
          {project.key}
        </p>
        {project.projectTypeKey && (
          <div className="flex items-center gap-1 mt-1.5">
            <Layers size={10} className="text-[#5E6C84] dark:text-gray-500" />
            <span className="text-xs text-[#5E6C84] dark:text-gray-500 capitalize">
              {project.projectTypeKey}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700">
      <Skeleton className="w-10 h-10 rounded" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, isLoading, error } = useProjects();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FolderOpen size={20} className="text-[#0052CC]" />
        <h1 className="text-xl font-semibold text-[#172B4D] dark:text-gray-100">Projects</h1>
        {!isLoading && (
          <span className="text-xs bg-[#DFE1E6] dark:bg-gray-700 text-[#42526E] dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
            {projects.length}
          </span>
        )}
      </div>

      {error ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-red-600">Failed to load projects. Please try again.</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-[#5E6C84] dark:text-gray-400">
          No projects found
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
