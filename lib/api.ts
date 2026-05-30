// lib/api.ts
import type {
  PokemonDetail, PokemonSpecies, EvolutionChain, MoveDetail, HeldItem
} from './types'
import { POKEAPI_BASE } from './constants'

async function apiFetch<T>(path: string): Promise<T> {
  // Ensure trailing slash before query string to avoid 301 redirects from the self-hosted API
  const [base, query] = path.split('?')
  const normalised = base.endsWith('/') ? base : `${base}/`
  const url = `${POKEAPI_BASE}${normalised}${query ? `?${query}` : ''}`
  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error(`PokeAPI ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchPokemonList(): Promise<{ id: number; name: string }[]> {
  const data = await apiFetch<{ results: { name: string; url: string }[] }>(
    '/pokemon?limit=1025&offset=0'
  )
  return data.results.map((p, i) => ({ id: i + 1, name: p.name }))
}

export async function fetchPokemonDetail(id: number): Promise<PokemonDetail> {
  return apiFetch(`/pokemon/${id}`)
}

export async function fetchPokemonSpecies(id: number): Promise<PokemonSpecies> {
  return apiFetch(`/pokemon-species/${id}`)
}

export async function fetchEvolutionChain(urlOrId: string | number): Promise<EvolutionChain> {
  if (typeof urlOrId === 'number') return apiFetch(`/evolution-chain/${urlOrId}`)
  const id = urlOrId.split('/evolution-chain/')[1].replace('/', '')
  return apiFetch(`/evolution-chain/${id}`)
}

export async function fetchMove(name: string): Promise<MoveDetail> {
  return apiFetch(`/move/${name}`)
}

export async function fetchHeldItemById(id: number): Promise<HeldItem> {
  const raw = await apiFetch<{
    id: number
    name: string
    names: { name: string; language: { name: string } }[]
    effect_entries: { short_effect: string; language: { name: string } }[]
  }>(`/item/${id}`)
  const displayName = raw.names.find(n => n.language.name === 'en')?.name ?? raw.name
  const effectSummary = raw.effect_entries.find(e => e.language.name === 'en')?.short_effect ?? ''
  return { id: raw.id, name: raw.name, displayName, effectSummary }
}

export async function fetchTypeChart(): Promise<Record<string, {
  double_damage_to: { name: string }[]
  half_damage_to: { name: string }[]
  no_damage_to: { name: string }[]
}>> {
  const typeNames = [
    'normal','fire','water','electric','grass','ice','fighting','poison',
    'ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy',
  ]
  const results = await Promise.all(
    typeNames.map(t => apiFetch<{ damage_relations: {
      double_damage_to: { name: string }[]
      half_damage_to: { name: string }[]
      no_damage_to: { name: string }[]
    } }>(`/type/${t}`))
  )
  return Object.fromEntries(typeNames.map((t, i) => [t, results[i].damage_relations]))
}
