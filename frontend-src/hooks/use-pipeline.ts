import useSWR from 'swr';
import { apiBackend } from '@/lib/api';
import type { PipelineTaskSummary, StageOutput, PipelineStage } from '@/types/opencode';

const fetcher = (url: string) => apiBackend.get(url).then((r) => r.data.data);

/**
 * Lấy pipeline summary của một task (poll mỗi 5s)
 */
export function usePipelineSummary(taskKey: string | null) {
  const { data, error, isLoading, mutate } = useSWR<PipelineTaskSummary>(
    taskKey ? `/api/opencode/pipeline/${taskKey}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  return {
    summary: data,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Lấy output của một stage cụ thể
 */
export function useStageOutput(taskKey: string | null, stage: PipelineStage | null) {
  const { data, error, isLoading, mutate } = useSWR<StageOutput>(
    taskKey && stage ? `/api/opencode/stage/${taskKey}/${stage}` : null,
    fetcher
  );

  return {
    output: data,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Lấy danh sách tất cả task keys có pipeline output
 */
export function usePipelineTasks() {
  const { data, error, isLoading, mutate } = useSWR<{ taskKeys: string[] }>(
    '/api/opencode/tasks',
    fetcher,
    { revalidateOnFocus: true }
  );

  return {
    taskKeys: data?.taskKeys ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
