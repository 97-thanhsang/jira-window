import { redirect, notFound } from 'next/navigation';
import type { PipelineStage } from '@/types/opencode';

const VALID_STAGES: PipelineStage[] = ['decompose', 'extractor', 'analyze', 'solution', 'execute'];

interface Props {
  params: Promise<{ taskKey: string; stage: string }>;
}

export default async function StagePage({ params }: Props) {
  const { taskKey, stage } = await params;

  if (!VALID_STAGES.includes(stage as PipelineStage)) {
    notFound();
  }

  // Redirect to new stage-centric URL
  redirect(`/opencode/${stage}?task=${taskKey}`);
}
