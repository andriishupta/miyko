import type { RequestContext } from '../../lib/types.js'

type Settings = { notificationsEnabled: boolean; preferredPlanningDays: number; language: 'uk' | 'en' }
const settings = new Map<string, Settings>()

export class SettingsService {
  get(context: RequestContext) { return settings.get(context.user.id) ?? { notificationsEnabled: true, preferredPlanningDays: 3, language: 'uk' as const } }
  update(context: RequestContext, patch: Partial<Settings>) {
    const next = { ...this.get(context), ...patch }
    settings.set(context.user.id, next)
    return next
  }
}
export const settingsService = new SettingsService()

