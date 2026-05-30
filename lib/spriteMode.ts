export type SpriteMode = 'modern' | 'retro' | 'ds'

const ASSET_BASE = 'https://madmaxlgndklrpokeapi.com/assets'

function genFromId(id: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  if (id <= 151)  return 1
  if (id <= 251)  return 2
  if (id <= 386)  return 3
  if (id <= 493)  return 4
  if (id <= 649)  return 5
  if (id <= 721)  return 6
  if (id <= 809)  return 7
  return 8
}

function pad3(id: number): string {
  return id.toString().padStart(3, '0')
}

export function getFallbackUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
}

export function getSpriteUrl(id: number, name: string, mode: SpriteMode): string {
  if (mode === 'retro') {
    if (id < 1 || id > 251) return getFallbackUrl(id)
    return `${ASSET_BASE}/pokemon_gen1sprites/crystal-jp-${pad3(id)}.png`
  }
  if (mode === 'ds') {
    if (id < 1 || id > 649) return getFallbackUrl(id)
    return `${ASSET_BASE}/pokemon_gen5_anim_sprites/${pad3(id)}.gif`
  }
  // modern
  const gen = genFromId(id)
  return `${ASSET_BASE}/pokemon_generation_${gen}_gifs/${name}.gif`
}
