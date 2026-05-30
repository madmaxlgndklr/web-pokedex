// lib/battle/BattleEngine.ts
import { calcDamage, randomFactor, getTypeEffectiveness } from './DamageEngine'
import type { PokemonDetail } from '@/lib/types'

export interface BattlePokemon {
  id: number
  name: string
  level: number
  types: string[]
  currentHp: number
  maxHp: number
  stats: number[]          // [hp, atk, def, spatk, spdef, spe]
  moves: BattleMove[]
  heldItem?: string
}

export interface BattleMove {
  name: string
  type: string
  category: 'physical' | 'special' | 'status'
  power: number
  accuracy: number
  pp: number
  currentPp: number
}

export type BattleState =
  | { phase: 'setup' }
  | { phase: 'player_turn' }
  | { phase: 'enemy_turn' }
  | { phase: 'result'; message: string }
  | { phase: 'won' }
  | { phase: 'lost' }

export interface BattleLog { turn: number; message: string }

export function buildBattlePokemon(
  detail: PokemonDetail,
  level: number,
  moveDetails: BattleMove[],
  stats: number[]
): BattlePokemon {
  return {
    id: detail.id,
    name: detail.name,
    level,
    types: detail.types.map(t => t.type.name),
    currentHp: stats[0],
    maxHp: stats[0],
    stats,
    moves: moveDetails,
  }
}

export function resolvePlayerAttack(
  player: BattlePokemon,
  enemy: BattlePokemon,
  moveIndex: number,
  typeChart: Record<string, { double_damage_to: {name:string}[]; half_damage_to: {name:string}[]; no_damage_to: {name:string}[] }>
): { updatedEnemy: BattlePokemon; damage: number; log: string; crit: boolean } {
  const move = player.moves[moveIndex]
  if (!move || move.currentPp <= 0) return { updatedEnemy: enemy, damage: 0, log: 'No PP left!', crit: false }

  const missRoll = Math.random() * 100
  if (missRoll > move.accuracy) {
    return { updatedEnemy: enemy, damage: 0, log: `${player.name.toUpperCase()} missed!`, crit: false }
  }

  const atk = move.category === 'physical' ? player.stats[1] : player.stats[3]
  const def = move.category === 'physical' ? enemy.stats[2] : enemy.stats[4]
  const stab = player.types.includes(move.type) ? 1.5 : 1
  const type = getTypeEffectiveness(move.type, enemy.types, typeChart)
  const crit = Math.random() < 0.0625
  const rf = randomFactor()

  const damage = calcDamage({ level: player.level, power: move.power, attack: atk, defense: def, stabMultiplier: stab, typeMultiplier: type, critMultiplier: crit ? 2 : 1, randomFactor: rf })
  const updatedEnemy = { ...enemy, currentHp: Math.max(0, enemy.currentHp - damage) }

  let log = `${player.name.toUpperCase()} used ${move.name.toUpperCase()}!`
  if (crit) log += ' Critical hit!'
  if (type > 1) log += " It's super effective!"
  if (type < 1 && type > 0) log += " It's not very effective..."
  if (type === 0) log += " It had no effect."
  log += ` ${damage} damage.`
  if (updatedEnemy.currentHp === 0) log += ` ${enemy.name.toUpperCase()} fainted!`

  return { updatedEnemy, damage, log, crit }
}

export function resolveEnemyAttack(
  enemy: BattlePokemon,
  player: BattlePokemon,
  typeChart: Parameters<typeof resolvePlayerAttack>[3]
): { updatedPlayer: BattlePokemon; damage: number; log: string } {
  const availableMoves = enemy.moves.filter(m => m.currentPp > 0 && m.power > 0)
  if (availableMoves.length === 0) return { updatedPlayer: player, damage: 0, log: `${enemy.name.toUpperCase()} has no moves!` }
  const move = availableMoves[Math.floor(Math.random() * availableMoves.length)]

  const atk = move.category === 'physical' ? enemy.stats[1] : enemy.stats[3]
  const def = move.category === 'physical' ? player.stats[2] : player.stats[4]
  const stab = enemy.types.includes(move.type) ? 1.5 : 1
  const type = getTypeEffectiveness(move.type, player.types, typeChart)
  const rf = randomFactor()

  const damage = calcDamage({ level: enemy.level, power: move.power, attack: atk, defense: def, stabMultiplier: stab, typeMultiplier: type, critMultiplier: 1, randomFactor: rf })
  const updatedPlayer = { ...player, currentHp: Math.max(0, player.currentHp - damage) }

  let log = `${enemy.name.toUpperCase()} used ${move.name.toUpperCase()}! ${damage} damage.`
  if (updatedPlayer.currentHp === 0) log += ` ${player.name.toUpperCase()} fainted!`

  return { updatedPlayer, damage, log }
}
