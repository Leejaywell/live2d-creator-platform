export type UsageAnalyticsRecord = {
  projectId: string;
  projectName: string;
  messageCount: number;
  tokenEstimate: number;
  createdAt: Date;
};

export type UsageAnalyticsSummary = {
  totalMessages: number;
  totalTokens: number;
  activeProjects: number;
  averageTokensPerMessage: number;
  daily: Array<{
    date: string;
    messages: number;
    tokens: number;
  }>;
  topProjects: Array<{
    projectId: string;
    projectName: string;
    messages: number;
    tokens: number;
  }>;
};

export function summarizeUsageAnalytics(records: UsageAnalyticsRecord[], options: { days: number; now?: Date }): UsageAnalyticsSummary {
  const now = options.now ?? new Date();
  const days = Math.max(1, options.days);
  const dateKeys = Array.from({ length: days }, (_, index) => dateKey(addDays(startOfUtcDay(now), index - days + 1)));
  const daily = new Map(dateKeys.map((key) => [key, { date: key, messages: 0, tokens: 0 }]));
  const byProject = new Map<string, { projectId: string; projectName: string; messages: number; tokens: number }>();

  let totalMessages = 0;
  let totalTokens = 0;

  records.forEach((record) => {
    totalMessages += record.messageCount;
    totalTokens += record.tokenEstimate;

    const day = daily.get(dateKey(record.createdAt));
    if (day) {
      day.messages += record.messageCount;
      day.tokens += record.tokenEstimate;
    }

    const project = byProject.get(record.projectId) ?? {
      projectId: record.projectId,
      projectName: record.projectName,
      messages: 0,
      tokens: 0,
    };
    project.messages += record.messageCount;
    project.tokens += record.tokenEstimate;
    byProject.set(record.projectId, project);
  });

  return {
    totalMessages,
    totalTokens,
    activeProjects: byProject.size,
    averageTokensPerMessage: totalMessages > 0 ? Math.round(totalTokens / totalMessages) : 0,
    daily: [...daily.values()],
    topProjects: [...byProject.values()].sort((a, b) => b.messages - a.messages || b.tokens - a.tokens).slice(0, 5),
  };
}

export function usageWindowStart(days: number, now = new Date()) {
  return addDays(startOfUtcDay(now), -Math.max(1, days) + 1);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
