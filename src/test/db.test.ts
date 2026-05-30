// src/test/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db'

beforeEach(async () => {
  await db.caught_pokemon.clear()
  await db.team.clear()
  await db.settings.clear()
})

describe('caught_pokemon', () => {
  it('adds and retrieves a caught pokemon', async () => {
    await db.caught_pokemon.add({ pokemonId: 1 })
    const all = await db.caught_pokemon.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].pokemonId).toBe(1)
  })

  it('deletes a caught pokemon', async () => {
    await db.caught_pokemon.add({ pokemonId: 25 })
    await db.caught_pokemon.delete(25)
    expect(await db.caught_pokemon.count()).toBe(0)
  })
})

describe('team', () => {
  it('stores team slots', async () => {
    await db.team.put({ slot: 0, pokemonId: 6 })
    await db.team.put({ slot: 1, pokemonId: 9 })
    const slots = await db.team.orderBy('slot').toArray()
    expect(slots.map(s => s.pokemonId)).toEqual([6, 9])
  })
})

describe('settings', () => {
  it('stores and retrieves a setting', async () => {
    await db.settings.put({ key: 'theme', value: 'light' })
    const s = await db.settings.get('theme')
    expect(s?.value).toBe('light')
  })
})
