export function getStatusBgColor(status: string | undefined): string {
  if (!status) return '#F4F5F7';
  const s = status.toLowerCase();
  if (['done', 'closed', 'resolved', 'completed'].some(x => s.includes(x))) return '#E3FCEF';
  if (['in progress', 'in review', 'development', 'testing', 'review'].some(x => s.includes(x))) return '#DEEBFF';
  if (['to do', 'open', 'backlog', 'new', 'selected for development'].some(x => s.includes(x))) return '#F4F5F7';
  if (['cancelled', 'rejected'].some(x => s.includes(x))) return '#F4F5F7';
  if (['blocked', 'impediment'].some(x => s.includes(x))) return '#FFEBE6';
  return '#F4F5F7';
}

export function getStatusColor(status: string | undefined): string {
  if (!status) return '#42526E';
  const s = status.toLowerCase();
  if (['done', 'closed', 'resolved', 'completed'].some(x => s.includes(x))) return '#006644';
  if (['in progress', 'in review', 'development', 'testing', 'review'].some(x => s.includes(x))) return '#0052CC';
  if (['to do', 'open', 'backlog', 'new', 'selected for development'].some(x => s.includes(x))) return '#42526E';
  if (['cancelled', 'rejected'].some(x => s.includes(x))) return '#6B778C';
  if (['blocked', 'impediment'].some(x => s.includes(x))) return '#DE350B';
  return '#42526E';
}

export function getDuedateColor(status: string | undefined, duedate: string | undefined): string {
  if (!duedate) return '#2684FF';
  const isDone = status && ['Done', 'Closed', 'Resolved', 'Completed'].some(s => status.includes(s));
  const isPast = new Date(duedate) < new Date(new Date().toISOString().slice(0, 10));
  if (isPast && isDone) return '#36B37E';
  if (isPast && !isDone) return '#DE350B';
  return '#2684FF';
}

export function typeAbbr(name: string): string {
  if (name === 'Sub-task') return 'SUB';
  if (name === 'Story') return 'STR';
  if (name === 'Bug') return 'BUG';
  if (name === 'Epic') return 'EPC';
  if (name === 'Task') return 'TSK';
  return name.slice(0, 3).toUpperCase();
}
