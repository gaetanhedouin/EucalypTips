export function resolveDateRange(params: {
  from?: string;
  to?: string;
  window?: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'ALL_TIME' | 'CUSTOM';
}): { from: Date; to: Date } {
  const now = new Date();

  if (params.window === 'CUSTOM' && params.from && params.to) {
    return { from: new Date(params.from), to: new Date(params.to) };
  }

  if (params.from && params.to) {
    return { from: new Date(params.from), to: new Date(params.to) };
  }

  const from = new Date(now);
  switch (params.window) {
    case 'DAY':
      from.setDate(now.getDate() - 1);
      break;
    case 'WEEK':
      from.setDate(now.getDate() - 7);
      break;
    case 'MONTH':
      from.setMonth(now.getMonth() - 1);
      break;
    case 'QUARTER':
      from.setMonth(now.getMonth() - 3);
      break;
    case 'ALL_TIME':
      from.setFullYear(2000);
      break;
    default:
      from.setDate(now.getDate() - 7);
      break;
  }

  return { from, to: now };
}
