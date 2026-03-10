export const BUILTIN_PROFILES = [
  {
    id: 'security-audit',
    name: 'Security Audit',
    icon: '🔒',
    description: 'Focus on security issues, warning+ severity',
    focusContext: '',
    reviewMode: 'deep',
    enabledAgents: ['bug', 'security', 'performance'],
    issueFilters: { minSeverity: 'warning', categories: ['security'] },
    builtin: true,
  },
  {
    id: 'critical-only',
    name: 'Critical Only',
    icon: '🔴',
    description: 'Critical issues only, fast mode',
    focusContext: '',
    reviewMode: 'fast',
    enabledAgents: ['bug', 'security', 'performance'],
    issueFilters: { minSeverity: 'critical', categories: ['bug', 'security', 'performance'] },
    builtin: true,
  },
  {
    id: 'performance',
    name: 'Performance Review',
    icon: '⚡',
    description: 'Performance issues only, deep mode',
    focusContext: '',
    reviewMode: 'deep',
    enabledAgents: ['bug', 'security', 'performance'],
    issueFilters: { minSeverity: 'info', categories: ['performance'] },
    builtin: true,
  },
  {
    id: 'show-all',
    name: 'Show All',
    icon: '✦',
    description: 'Reset filters, fast mode',
    focusContext: '',
    reviewMode: 'fast',
    enabledAgents: ['bug', 'security', 'performance'],
    issueFilters: { minSeverity: 'info', categories: ['bug', 'security', 'performance'] },
    builtin: true,
  },
]

export function findProfile(id, userProfiles) {
  return BUILTIN_PROFILES.find((p) => p.id === id) ?? userProfiles.find((p) => p.id === id) ?? null
}
