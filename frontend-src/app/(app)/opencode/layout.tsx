import { OpenCodeStageNav } from '@/components/opencode/opencode-stage-nav';

export default function OpenCodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <OpenCodeStageNav />
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        {children}
      </div>
    </div>
  );
}
