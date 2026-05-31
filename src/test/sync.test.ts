import { describe, it, expect } from 'vitest'
import {
  mergeCaughtPokemon,
  mergeTeam,
  mergeTrainerRecords,
  mergeWildRecords,
  mergeBattleConfig,
  mergeSettings,
} from '../../lib/sync-merge'

describe('mergeCaughtPokemon', () => {
  it('unions local and remote pokemon ids', () => {
    const result = mergeCaughtPokemon([1, 2], [2, 3])
    expect(result).toEqual(expect.arrayContaining([1, 2, 3]))
    expect(result).toHaveLength(3)
  })

  it('handles empty local', () => {
    expect(mergeCaughtPokemon([], [4, 5])).toEqual([4, 5])
  })

  it('handles empty remote', () => {
    expect(mergeCaughtPokemon([1], [])).toEqual([1])
  })
})

describe('mergeTeam', () => {
  it('keeps remote team when remote is newer', () => {
    const result = mergeTeam([1, 2, 3], 1000, [4, 5, 6], 2000)
    expect(result).toEqual([4, 5, 6])
  })

  it('keeps local team when local is newer', () => {
    const result = mergeTeam([1, 2, 3], 3000, [4, 5, 6], 2000)
    expect(result).toEqual([1, 2, 3])
  })

  it('keeps local team when timestamps are equal', () => {
    const result = mergeTeam([1, 2], 1000, [3, 4], 1000)
    expect(result).toEqual([1, 2])
  })

  it('keeps local when remote is null', () => {
    const result = mergeTeam([1, 2], 1000, null, null)
    expect(result).toEqual([1, 2])
  })
})

describe('mergeTrainerRecords', () => {
  it('takes max wins and losses, min first_defeated_at, max last_battled_at', () => {
    const local = { trainerId: 'brock', name: 'Brock', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'rock', wins: 3, losses: 1, firstDefeatedAt: 100, lastBattledAt: 500 }
    const remote = { trainer_id: 'brock', name: 'Brock', title: 'Gym Leader', region: 'kanto', trainer_class: 'gym', type_specialty: 'rock', wins: 5, losses: 2, first_defeated_at: 200, last_battled_at: 400 }
    const result = mergeTrainerRecords([local], [remote])
    expect(result[0].wins).toBe(5)
    expect(result[0].losses).toBe(2)
    expect(result[0].firstDefeatedAt).toBe(100)
    expect(result[0].lastBattledAt).toBe(500)
  })

  it('includes trainers only in local', () => {
    const local = { trainerId: 'misty', name: 'Misty', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'water', wins: 1, losses: 0, firstDefeatedAt: 100, lastBattledAt: 100 }
    const result = mergeTrainerRecords([local], [])
    expect(result).toHaveLength(1)
    expect(result[0].trainerId).toBe('misty')
  })

  it('includes trainers only in remote', () => {
    const remote = { trainer_id: 'lt-surge', name: 'Lt. Surge', title: 'Gym Leader', region: 'kanto', trainer_class: 'gym', type_specialty: 'electric', wins: 0, losses: 1, first_defeated_at: null, last_battled_at: 200 }
    const result = mergeTrainerRecords([], [remote])
    expect(result[0].trainerId).toBe('lt-surge')
  })

  it('uses min non-null firstDefeatedAt when local is undefined', () => {
    const local = { trainerId: 'erika', name: 'Erika', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'grass', wins: 0, losses: 1, firstDefeatedAt: undefined, lastBattledAt: 100 }
    const remote = { trainer_id: 'erika', name: 'Erika', title: 'Gym Leader', region: 'kanto', trainer_class: 'gym', type_specialty: 'grass', wins: 1, losses: 0, first_defeated_at: 300, last_battled_at: 300 }
    const result = mergeTrainerRecords([local], [remote])
    expect(result[0].firstDefeatedAt).toBe(300)
  })
})

describe('mergeWildRecords', () => {
  it('takes max wins and losses, max last_battled_at', () => {
    const local = { pokemonId: 25, pokemonName: 'pikachu', wins: 2, losses: 1, lastBattledAt: 500 }
    const remote = { pokemon_id: 25, pokemon_name: 'pikachu', wins: 3, losses: 0, last_battled_at: 400 }
    const result = mergeWildRecords([local], [remote])
    expect(result[0].wins).toBe(3)
    expect(result[0].losses).toBe(1)
    expect(result[0].lastBattledAt).toBe(500)
  })

  it('includes wild pokemon only in remote', () => {
    const remote = { pokemon_id: 1, pokemon_name: 'bulbasaur', wins: 2, losses: 0, last_battled_at: 100 }
    const result = mergeWildRecords([], [remote])
    expect(result[0].pokemonId).toBe(1)
    expect(result[0].wins).toBe(2)
  })
})

describe('mergeBattleConfig', () => {
  it('keeps remote when remote is newer', () => {
    const result = mergeBattleConfig('{"slot":0}', 1000, '{"slot":1}', 2000)
    expect(result).toBe('{"slot":1}')
  })

  it('keeps local when local is newer', () => {
    const result = mergeBattleConfig('{"slot":0}', 3000, '{"slot":1}', 2000)
    expect(result).toBe('{"slot":0}')
  })

  it('keeps local when remote is null', () => {
    const result = mergeBattleConfig('{"slot":0}', 1000, null, null)
    expect(result).toBe('{"slot":0}')
  })
})

describe('mergeSettings', () => {
  it('keeps remote when remote is newer', () => {
    const result = mergeSettings({ generation: 3, musicOnLaunch: false, trainerName: '', updatedAt: 1000 }, { generation: 4, musicOnLaunch: true, trainerName: '', updatedAt: 2000 })
    expect(result.generation).toBe(4)
  })

  it('keeps local when local is newer', () => {
    const result = mergeSettings({ generation: 5, musicOnLaunch: true, trainerName: '', updatedAt: 3000 }, { generation: 3, musicOnLaunch: false, trainerName: '', updatedAt: 1000 })
    expect(result.generation).toBe(5)
  })

  it('keeps local when remote is null', () => {
    const result = mergeSettings({ generation: 3, musicOnLaunch: false, trainerName: '', updatedAt: 1000 }, null)
    expect(result.generation).toBe(3)
  })

  describe('trainerName', () => {
    it('remote wins when newer', () => {
      const local = { generation: 5, musicOnLaunch: false, trainerName: 'ASH', updatedAt: 100 }
      const remote = { generation: 3, musicOnLaunch: true, trainerName: 'MISTY', updatedAt: 200 }
      const result = mergeSettings(local, remote)
      expect(result.trainerName).toBe('MISTY')
    })

    it('local wins when newer', () => {
      const local = { generation: 5, musicOnLaunch: false, trainerName: 'ASH', updatedAt: 300 }
      const remote = { generation: 3, musicOnLaunch: true, trainerName: 'MISTY', updatedAt: 200 }
      const result = mergeSettings(local, remote)
      expect(result.trainerName).toBe('ASH')
    })

    it('local returned when remote is null', () => {
      const local = { generation: 5, musicOnLaunch: false, trainerName: 'ASH', updatedAt: 100 }
      const result = mergeSettings(local, null)
      expect(result.trainerName).toBe('ASH')
    })
  })
})
