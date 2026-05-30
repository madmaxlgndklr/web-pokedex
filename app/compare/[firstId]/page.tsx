export const dynamic = 'force-dynamic'
import { fetchPokemonDetail, fetchPokemonList } from '@/lib/api'
import { notFound } from 'next/navigation'
import { CompareClient } from './CompareClient'

interface Props { params: { firstId: string } }

export default async function ComparePage({ params }: Props) {
  const id = parseInt(params.firstId)
  if (isNaN(id) || id < 1) notFound()
  const [first, allPokemon] = await Promise.all([
    fetchPokemonDetail(id),
    fetchPokemonList(),
  ])
  return <CompareClient first={first} allPokemon={allPokemon} />
}
