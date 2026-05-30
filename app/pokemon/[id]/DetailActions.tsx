'use client'
import { useRouter } from 'next/navigation'
import { useCaughtPokemon, useTeam } from '@/lib/db'
import { Button } from '@/components/ui/Button'

interface Props { pokemonId: number }

export function DetailActions({ pokemonId }: Props) {
  const { caught, toggle } = useCaughtPokemon()
  const { teamIds, add, remove } = useTeam()
  const router = useRouter()
  const isCaught = caught.has(pokemonId)
  const isOnTeam = teamIds.includes(pokemonId)

  return (
    <div className="flex gap-2 flex-wrap mt-4">
      <Button onClick={() => toggle(pokemonId)} variant={isCaught ? 'secondary' : 'primary'}>
        {isCaught ? '★ CAUGHT' : '☆ CATCH'}
      </Button>
      <Button onClick={() => isOnTeam ? remove(pokemonId) : add(pokemonId)} variant="secondary">
        {isOnTeam ? '- TEAM' : '+ TEAM'}
      </Button>
      <Button onClick={() => router.push(`/compare/${pokemonId}`)} variant="secondary">
        COMPARE
      </Button>
      <Button onClick={() => router.push(`/battle?preloadId=${pokemonId}`)}>
        BATTLE
      </Button>
    </div>
  )
}
