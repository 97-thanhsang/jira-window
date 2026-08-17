import { Suspense } from 'react';
import { StageScreen } from '@/components/opencode/stage-screen';

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded" />}>
      <StageScreen stage="analyze" />
    </Suspense>
  );
}
