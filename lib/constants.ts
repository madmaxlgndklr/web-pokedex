// lib/constants.ts

export const POKEAPI_BASE =
  process.env.POKEAPI_BASE ?? 'https://madmaxlgndklrpokeapi.com/api/v2'

export const spriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

export const shinySpriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`

export const POKEMON_COUNT = 1025

export const GENERATIONS = [
  { label: 'Gen I',   min: 1,   max: 151  },
  { label: 'Gen II',  min: 152, max: 251  },
  { label: 'Gen III', min: 252, max: 386  },
  { label: 'Gen IV',  min: 387, max: 493  },
  { label: 'Gen V',   min: 494, max: 649  },
  { label: 'Gen VI',  min: 650, max: 721  },
  { label: 'Gen VII', min: 722, max: 809  },
  { label: 'Gen VIII',min: 810, max: 905  },
  { label: 'Gen IX',  min: 906, max: 1025 },
] as const

export const TYPE_COLORS: Record<string, string> = {
  normal:   '#a8a878', fire:     '#f08030', water:    '#6890f0',
  electric: '#f8d030', grass:    '#78c850', ice:      '#98d8d8',
  fighting: '#c03028', poison:   '#a040a0', ground:   '#e0c068',
  flying:   '#a890f0', psychic:  '#f85888', bug:      '#a8b820',
  rock:     '#b8a038', ghost:    '#705898', dragon:   '#7038f8',
  dark:     '#705848', steel:    '#b8b8d0', fairy:    '#ee99ac',
}

export const STAT_COLORS: Record<string, string> = {
  hp:               '#ff5959', attack:          '#f5ac78',
  defense:          '#fae078', 'special-attack': '#9db7f5',
  'special-defense':'#a7db8d',  speed:           '#fa92b2',
}

export const NATURES = [
  { name: 'Hardy',   boosted: null, dropped: null },
  { name: 'Lonely',  boosted: 1,    dropped: 2    },
  { name: 'Brave',   boosted: 1,    dropped: 5    },
  { name: 'Adamant', boosted: 1,    dropped: 3    },
  { name: 'Naughty', boosted: 1,    dropped: 4    },
  { name: 'Bold',    boosted: 2,    dropped: 1    },
  { name: 'Docile',  boosted: null, dropped: null },
  { name: 'Relaxed', boosted: 2,    dropped: 5    },
  { name: 'Impish',  boosted: 2,    dropped: 3    },
  { name: 'Lax',     boosted: 2,    dropped: 4    },
  { name: 'Timid',   boosted: 5,    dropped: 1    },
  { name: 'Hasty',   boosted: 5,    dropped: 2    },
  { name: 'Serious', boosted: null, dropped: null },
  { name: 'Jolly',   boosted: 5,    dropped: 3    },
  { name: 'Naive',   boosted: 5,    dropped: 4    },
  { name: 'Modest',  boosted: 3,    dropped: 1    },
  { name: 'Mild',    boosted: 3,    dropped: 2    },
  { name: 'Quiet',   boosted: 3,    dropped: 5    },
  { name: 'Bashful', boosted: null, dropped: null },
  { name: 'Rash',    boosted: 3,    dropped: 4    },
  { name: 'Calm',    boosted: 4,    dropped: 1    },
  { name: 'Gentle',  boosted: 4,    dropped: 2    },
  { name: 'Sassy',   boosted: 4,    dropped: 5    },
  { name: 'Careful', boosted: 4,    dropped: 3    },
  { name: 'Quirky',  boosted: null, dropped: null },
] as const
