// app/page.tsx
export const dynamic = 'force-dynamic'
import { fetchPokemonList } from '@/lib/api'
import { HomeSearch } from './HomeSearch'

export default async function HomePage() {
  const pokemon = await fetchPokemonList()
  return <HomeSearch allPokemon={pokemon} />
}
