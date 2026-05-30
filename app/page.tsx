// app/page.tsx
import { fetchPokemonList } from '@/lib/api'
import { HomeSearch } from './HomeSearch'

export default async function HomePage() {
  const pokemon = await fetchPokemonList()
  return <HomeSearch allPokemon={pokemon} />
}
