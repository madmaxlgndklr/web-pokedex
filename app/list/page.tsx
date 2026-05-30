// app/list/page.tsx
import { fetchPokemonList } from '@/lib/api'
import { PokemonListClient } from './PokemonListClient'

export default async function ListPage() {
  const pokemon = await fetchPokemonList()
  return <PokemonListClient allPokemon={pokemon} />
}
