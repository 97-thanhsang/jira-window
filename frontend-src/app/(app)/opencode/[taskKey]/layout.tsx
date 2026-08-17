// Passthrough — the parent opencode/layout.tsx handles navigation.
// This layout exists only to avoid conflicts with old direct task-key URLs
// which now redirect to /opencode/[stage]?task=[taskKey].
export default function TaskKeyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
