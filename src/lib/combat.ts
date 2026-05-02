import type { EnemyAction, EnemyPattern } from '../schemas'

export function activeEnemyActions(
  pattern: EnemyPattern,
  turn: number,
): EnemyAction[] {
  const phases = pattern.phases ?? []
  let active = pattern.actions
  for (const phase of phases) {
    if (turn >= phase.atTurn) active = phase.actionsOverride
  }
  return active
}

export function currentEnemyAction(
  pattern: EnemyPattern,
  turn: number,
): EnemyAction {
  const actions = activeEnemyActions(pattern, turn)
  return actions[(turn - 1) % actions.length]
}
