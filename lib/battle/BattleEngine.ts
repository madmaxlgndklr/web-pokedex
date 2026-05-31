// lib/battle/BattleEngine.ts
import { isPhysicalGen23 } from './DamageEngine'
import { computeEffectiveness, effectivenessLabel } from './TypeChart'
import { StatFormulas, Natures } from './StatConfig'
import type { StatConfig, Nature } from './StatConfig'
import type { HeldItem } from '@/lib/types'

export interface BattleMove {
  name: string
  type: string
  category: 'physical' | 'special' | 'status'
  power: number
  accuracy: number
  pp: number
  currentPp: number
}

export interface BattlePokemon {
  id: number
  name: string
  level: number
  types: string[]
  currentHp: number
  maxHp: number
  baseStats: Record<string, number>  // raw base stats from PokemonDetail
  moves: BattleMove[]
  statConfig: StatConfig
  nature: Nature
  heldItem?: HeldItem | null
}

export type TurnAction =
  | { kind: 'use_move'; move: BattleMove }
  | { kind: 'switch_to'; targetIndex: number }

export type BattleState =
  | { phase: 'ongoing'; playerTeam: BattlePokemon[]; playerActiveIndex: number; opponentTeam: BattlePokemon[]; opponentActiveIndex: number; log: string[] }
  | { phase: 'pending_switch'; playerTeam: BattlePokemon[]; playerActiveIndex: number; opponentTeam: BattlePokemon[]; opponentActiveIndex: number; log: string[] }
  | { phase: 'won'; log: string[] }
  | { phase: 'lost'; log: string[] }

function baseStat(p: BattlePokemon, name: string): number {
  return p.baseStats[name] ?? 50
}

function applyMoveInternal(
  attacker: BattlePokemon,
  move: BattleMove,
  defender: BattlePokemon,
  gen: number,
  log: string[]
): [BattlePokemon, BattlePokemon] {
  const label = `${attacker.name.toUpperCase()} used ${move.name.toUpperCase().replace(/-/g, ' ')}!`
  if (move.power === 0 || move.category === 'status') {
    log.push(label)
    return [attacker, defender]
  }

  const isPhysical = gen >= 4
    ? move.category === 'physical'
    : gen <= 1 ? true : isPhysicalGen23(move.type)

  const atkStatName = isPhysical ? 'attack' : 'special-attack'
  const defStatName = isPhysical ? 'defense' : 'special-defense'
  const atkStatIdx  = isPhysical ? 1 : 3
  const defStatIdx  = isPhysical ? 2 : 4

  const effectiveness = computeEffectiveness(gen, move.type, defender.types)
  const effLabel = effectivenessLabel(effectiveness)
  const crit = Math.random() < 0.0625
  const critMult = crit ? (gen <= 5 ? 2 : 1.5) : 1
  const [randMin, randMax] = gen === 1 ? [217 / 255, 1] : [0.85, 1]
  const rand = randMin + Math.random() * (randMax - randMin)

  let atk = StatFormulas.computeStat(
    baseStat(attacker, atkStatName), attacker.statConfig, attacker.nature, atkStatIdx, attacker.level
  )
  const def = StatFormulas.computeStat(
    baseStat(defender, defStatName), defender.statConfig, defender.nature, defStatIdx, defender.level
  )

  const itemName = attacker.heldItem?.name ?? ''
  if (itemName === 'choice-band' && atkStatIdx === 1) atk = Math.floor(atk * 1.5)
  if (itemName === 'choice-specs' && atkStatIdx === 3) atk = Math.floor(atk * 1.5)
  if (itemName === 'muscle-band' && atkStatIdx === 1) atk = Math.floor(atk * 1.1)
  if (itemName === 'wise-glasses' && atkStatIdx === 3) atk = Math.floor(atk * 1.1)

  const stab = attacker.types.includes(move.type) ? 1.5 : 1
  const base = Math.floor(Math.floor(2 * attacker.level / 5 + 2) * move.power * atk / def / 50) + 2
  let dmg = Math.max(1, Math.round(base * stab * effectiveness * critMult * rand))

  if (itemName === 'life-orb') dmg = Math.floor(dmg * 1.3)
  if (itemName === 'expert-belt' && effectiveness > 1) dmg = Math.floor(dmg * 1.2)
  const typeBoosts: Record<string, string> = {
    charcoal: 'fire', 'mystic-water': 'water', magnet: 'electric', 'miracle-seed': 'grass',
    'never-melt-ice': 'ice', 'black-belt': 'fighting', 'poison-barb': 'poison', 'soft-sand': 'ground',
    'sharp-beak': 'flying', 'twisted-spoon': 'psychic', 'silver-powder': 'bug', 'hard-stone': 'rock',
    'spell-tag': 'ghost', 'dragon-fang': 'dragon', 'black-glasses': 'dark', 'metal-coat': 'steel',
    'fairy-feather': 'fairy', 'silk-scarf': 'normal',
    'flame-plate': 'fire', 'splash-plate': 'water', 'zap-plate': 'electric', 'meadow-plate': 'grass',
    'icicle-plate': 'ice', 'fist-plate': 'fighting', 'toxic-plate': 'poison', 'earth-plate': 'ground',
    'sky-plate': 'flying', 'mind-plate': 'psychic', 'insect-plate': 'bug', 'stone-plate': 'rock',
    'spooky-plate': 'ghost', 'draco-plate': 'dragon', 'dread-plate': 'dark', 'iron-plate': 'steel',
    'pixie-plate': 'fairy',
  }
  if (typeBoosts[itemName] === move.type) dmg = Math.floor(dmg * 1.2)

  dmg = Math.min(dmg, defender.currentHp)
  const newHp = Math.max(0, defender.currentHp - dmg)

  log.push(`${label} (${effLabel})`)
  if (effLabel === '0×') log.push("It had no effect!")
  else if (effectiveness > 1) log.push("It's super effective!")
  else if (effectiveness < 1) log.push("It's not very effective...")
  if (crit) log.push("Critical hit!")

  const updatedMove = { ...move, currentPp: Math.max(0, move.currentPp - 1) }
  const updatedAttacker = { ...attacker, moves: attacker.moves.map(m => m === move ? updatedMove : m) }
  const updatedDefender = { ...defender, currentHp: newHp }
  return [updatedAttacker, updatedDefender]
}

function switchScore(candidate: BattlePokemon, opponent: BattlePokemon, gen: number): number {
  const oppBestType = opponent.moves
    .filter(m => m.power > 0)
    .sort((a, b) => b.power - a.power)[0]?.type ?? 'normal'
  const typeAdv = computeEffectiveness(gen, oppBestType, candidate.types)
  const defenseFactor = typeAdv === 0 ? 10 : 1 / typeAdv
  const hpFraction = candidate.currentHp / candidate.maxHp
  return defenseFactor * hpFraction
}

function aiForcedSwitchIndex(team: BattlePokemon[]): number | null {
  const idx = team.findIndex(p => p.currentHp > 0)
  return idx >= 0 ? idx : null
}

function aiPickMove(pokemon: BattlePokemon): BattleMove {
  const usable = pokemon.moves.filter(m => m.currentPp > 0 && m.power > 0 && m.category !== 'status')
  if (usable.length > 0) return usable.sort((a, b) => b.power - a.power)[0]
  const anyUsable = pokemon.moves.find(m => m.currentPp > 0)
  return anyUsable ?? pokemon.moves[0]
}

export function aiPickAction(
  active: BattlePokemon,
  opponentActive: BattlePokemon,
  team: BattlePokemon[],
  gen: number
): TurnAction {
  const currentScore = switchScore(active, opponentActive, gen)
  const candidates = team
    .map((p, i) => ({ i, p }))
    .filter(({ p }) => p !== active && p.currentHp > 0)

  if (candidates.length > 0) {
    const best = candidates.sort((a, b) => switchScore(b.p, opponentActive, gen) - switchScore(a.p, opponentActive, gen))[0]
    const bestScore = switchScore(best.p, opponentActive, gen)
    const oppBestType = opponentActive.moves
      .filter(m => m.power > 0)
      .sort((a, b) => b.power - a.power)[0]?.type ?? 'normal'
    const has4x = computeEffectiveness(gen, oppBestType, active.types) >= 4
    const lowHp = active.currentHp / active.maxHp < 0.25
    if ((has4x || lowHp) && bestScore > currentScore * 1.5) {
      return { kind: 'switch_to', targetIndex: best.i }
    }
  }

  return { kind: 'use_move', move: aiPickMove(active) }
}

export function buildBattlePokemon(
  id: number,
  name: string,
  types: string[],
  baseStatMap: Record<string, number>,
  level: number,
  moves: BattleMove[],
  statConfig: StatConfig = { kind: 'gen3plus', ivs: [31,31,31,31,31,31], evs: [0,0,0,0,0,0] },
  nature: Nature = Natures.HARDY,
  heldItem?: HeldItem | null
): BattlePokemon {
  const hpBase = baseStatMap['hp'] ?? 45
  const maxHp = StatFormulas.computeHp(hpBase, statConfig, level)
  return { id, name, types, level, currentHp: maxHp, maxHp, baseStats: baseStatMap, moves, statConfig, nature, heldItem }
}

export function startBattle(
  playerTeam: BattlePokemon[],
  opponentTeam: BattlePokemon[],
  initialLog: string[] = []
): BattleState {
  return {
    phase: 'ongoing',
    playerTeam,
    playerActiveIndex: 0,
    opponentTeam,
    opponentActiveIndex: 0,
    log: initialLog.length > 0 ? initialLog : [`A wild ${opponentTeam[0].name.toUpperCase()} appeared!`],
  }
}

export function confirmSwitch(newIndex: number, state: Extract<BattleState, { phase: 'pending_switch' }>): BattleState {
  if (newIndex < 0 || newIndex >= state.playerTeam.length) return state
  if (newIndex === state.playerActiveIndex) return state
  if (state.playerTeam[newIndex].currentHp <= 0) return state
  return {
    phase: 'ongoing',
    playerTeam: state.playerTeam,
    playerActiveIndex: newIndex,
    opponentTeam: state.opponentTeam,
    opponentActiveIndex: state.opponentActiveIndex,
    log: [...state.log, `Go, ${state.playerTeam[newIndex].name.toUpperCase()}!`],
  }
}

export function resolveTurn(
  playerAction: TurnAction,
  opponentAction: TurnAction,
  state: Extract<BattleState, { phase: 'ongoing' }>,
  gen: number
): BattleState {
  // Player voluntary switch — resolves before opponent's move
  if (playerAction.kind === 'switch_to') {
    const newIdx = Math.max(0, Math.min(playerAction.targetIndex, state.playerTeam.length - 1))
    let playerTeam = [...state.playerTeam]
    let opponentTeam = [...state.opponentTeam]
    const playerIdx = newIdx
    let opponentIdx = state.opponentActiveIndex
    const log: string[] = [
      `${state.playerTeam[state.playerActiveIndex].name.toUpperCase()} withdrew!`,
      `Go, ${playerTeam[newIdx].name.toUpperCase()}!`,
    ]

    if (opponentAction.kind === 'use_move') {
      const [newOpp, newPlayer] = applyMoveInternal(opponentTeam[opponentIdx], opponentAction.move, playerTeam[playerIdx], gen, log)
      opponentTeam = opponentTeam.map((p, i) => i === opponentIdx ? newOpp : p)
      playerTeam = playerTeam.map((p, i) => i === playerIdx ? newPlayer : p)
      if (playerTeam[playerIdx].currentHp <= 0) {
        log.push(`${playerTeam[playerIdx].name.toUpperCase()} fainted!`)
        const endLog = [...state.log, ...log]
        const alive = playerTeam.filter(p => p.currentHp > 0).length
        return alive === 0
          ? { phase: 'lost', log: endLog }
          : { phase: 'pending_switch', playerTeam, playerActiveIndex: playerIdx, opponentTeam, opponentActiveIndex: opponentIdx, log: endLog }
      }
    } else if (opponentAction.kind === 'switch_to') {
      const oppNewIdx = Math.max(0, Math.min(opponentAction.targetIndex, opponentTeam.length - 1))
      log.push(`Opponent withdrew ${opponentTeam[opponentIdx].name.toUpperCase()}!`)
      opponentIdx = oppNewIdx
      log.push(`Opponent sent out ${opponentTeam[opponentIdx].name.toUpperCase()}!`)
    }

    return { phase: 'ongoing', playerTeam, playerActiveIndex: playerIdx, opponentTeam, opponentActiveIndex: opponentIdx, log: [...state.log, ...log] }
  }

  // Both use moves — speed priority
  const playerMove = (playerAction as Extract<TurnAction, { kind: 'use_move' }>).move
  const opponentMove = opponentAction.kind === 'use_move' ? opponentAction.move : null

  const playerSpeed = baseStat(state.playerTeam[state.playerActiveIndex], 'speed')
  const opponentSpeed = baseStat(state.opponentTeam[state.opponentActiveIndex], 'speed')
  const playerFirst = playerSpeed > opponentSpeed ? true : playerSpeed < opponentSpeed ? false : Math.random() < 0.5

  let playerTeam = [...state.playerTeam]
  let opponentTeam = [...state.opponentTeam]
  const playerIdx = state.playerActiveIndex
  let opponentIdx = state.opponentActiveIndex
  const log: string[] = []

  // Opponent switch during same turn
  if (opponentMove === null && opponentAction.kind === 'switch_to') {
    const newOppIdx = Math.max(0, Math.min(opponentAction.targetIndex, opponentTeam.length - 1))
    log.push(`Opponent withdrew ${opponentTeam[opponentIdx].name.toUpperCase()}!`)
    opponentIdx = newOppIdx
    log.push(`Opponent sent out ${opponentTeam[opponentIdx].name.toUpperCase()}!`)
  }

  // First move
  const firstIsPlayer = playerFirst
  const applyFirst = () => {
    if (firstIsPlayer) {
      const [newP, newOpp] = applyMoveInternal(playerTeam[playerIdx], playerMove, opponentTeam[opponentIdx], gen, log)
      playerTeam = playerTeam.map((p, i) => i === playerIdx ? newP : p)
      opponentTeam = opponentTeam.map((p, i) => i === opponentIdx ? newOpp : p)
    } else if (opponentMove) {
      const [newOpp, newP] = applyMoveInternal(opponentTeam[opponentIdx], opponentMove, playerTeam[playerIdx], gen, log)
      opponentTeam = opponentTeam.map((p, i) => i === opponentIdx ? newOpp : p)
      playerTeam = playerTeam.map((p, i) => i === playerIdx ? newP : p)
    }
  }
  applyFirst()

  // Check faint after first move
  if (!firstIsPlayer && playerTeam[playerIdx].currentHp <= 0) {
    log.push(`${playerTeam[playerIdx].name.toUpperCase()} fainted!`)
    const endLog = [...state.log, ...log]
    const alive = playerTeam.filter(p => p.currentHp > 0).length
    return alive === 0
      ? { phase: 'lost', log: endLog }
      : { phase: 'pending_switch', playerTeam, playerActiveIndex: playerIdx, opponentTeam, opponentActiveIndex: opponentIdx, log: endLog }
  }
  if (firstIsPlayer && opponentTeam[opponentIdx].currentHp <= 0) {
    log.push(`${opponentTeam[opponentIdx].name.toUpperCase()} fainted!`)
    const endLog = [...state.log, ...log]
    const aliveOpp = opponentTeam.filter(p => p.currentHp > 0).length
    if (aliveOpp === 0) return { phase: 'won', log: endLog }
    const nextIdx = aiForcedSwitchIndex(opponentTeam)
    if (nextIdx === null) return { phase: 'won', log: endLog }
    opponentIdx = nextIdx
    log.push(`A new ${opponentTeam[opponentIdx].name.toUpperCase()} appeared!`)
  }

  // Second move
  if (opponentMove !== null || !firstIsPlayer) {
    const secondIsPlayer = !firstIsPlayer
    const secondCanAct = secondIsPlayer
      ? playerTeam[playerIdx].currentHp > 0
      : opponentTeam[opponentIdx].currentHp > 0

    if (secondCanAct) {
      if (secondIsPlayer) {
        const [newP, newOpp] = applyMoveInternal(playerTeam[playerIdx], playerMove, opponentTeam[opponentIdx], gen, log)
        playerTeam = playerTeam.map((p, i) => i === playerIdx ? newP : p)
        opponentTeam = opponentTeam.map((p, i) => i === opponentIdx ? newOpp : p)
      } else if (opponentMove) {
        const [newOpp, newP] = applyMoveInternal(opponentTeam[opponentIdx], opponentMove, playerTeam[playerIdx], gen, log)
        opponentTeam = opponentTeam.map((p, i) => i === opponentIdx ? newOpp : p)
        playerTeam = playerTeam.map((p, i) => i === playerIdx ? newP : p)
      }

      if (!secondIsPlayer && playerTeam[playerIdx].currentHp <= 0) {
        log.push(`${playerTeam[playerIdx].name.toUpperCase()} fainted!`)
        const endLog = [...state.log, ...log]
        const alive = playerTeam.filter(p => p.currentHp > 0).length
        return alive === 0
          ? { phase: 'lost', log: endLog }
          : { phase: 'pending_switch', playerTeam, playerActiveIndex: playerIdx, opponentTeam, opponentActiveIndex: opponentIdx, log: endLog }
      }
      if (secondIsPlayer && opponentTeam[opponentIdx].currentHp <= 0) {
        log.push(`${opponentTeam[opponentIdx].name.toUpperCase()} fainted!`)
        const endLog = [...state.log, ...log]
        const aliveOpp = opponentTeam.filter(p => p.currentHp > 0).length
        if (aliveOpp === 0) return { phase: 'won', log: endLog }
        const nextIdx = aiForcedSwitchIndex(opponentTeam)
        if (nextIdx === null) return { phase: 'won', log: endLog }
        opponentIdx = nextIdx
        log.push(`A new ${opponentTeam[opponentIdx].name.toUpperCase()} appeared!`)
      }
    }
  }

  return { phase: 'ongoing', playerTeam, playerActiveIndex: playerIdx, opponentTeam, opponentActiveIndex: opponentIdx, log: [...state.log, ...log] }
}
