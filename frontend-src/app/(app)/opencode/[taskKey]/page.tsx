import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ taskKey: string }>;
}

export default async function TaskPipelinePage({ params }: Props) {
  const { taskKey } = await params;
  redirect(`/opencode/decompose?task=${taskKey}`);
}
