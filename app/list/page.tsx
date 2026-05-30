// app/list/page.tsx
export const dynamic = 'force-dynamic'
import { fetchPokemonList } from '@/lib/api'
import { PokemonListClient } from './PokemonListClient'

export default async function ListPage() {
  const pokemon = await fetchPokemonList()
  return <PokemonListClient allPokemon={pokemon} />
}
