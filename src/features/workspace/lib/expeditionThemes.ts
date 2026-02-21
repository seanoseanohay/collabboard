export interface ExpeditionTheme {
  id: string
  name: string
  emoji: string
  landFills: string[]
  waterFill: string
  accentColor: string
  continentNames: string[]
  islandNames: string[]
  townNames: string[]
  oceanNames: string[]
  landmarks: string[]
  treasureNames: string[]
}

export const EXPEDITION_THEMES: ExpeditionTheme[] = [
  {
    id: 'pirate-seas',
    name: 'Pirate Seas',
    emoji: '🏴‍☠️',
    landFills: ['#8fbc8f', '#deb887', '#c2b280', '#9acd32', '#d2b48c'],
    waterFill: '#b3d9ff',
    accentColor: '#8b6914',
    continentNames: ['Emerald Atoll', 'The Shattered Isles', 'Windward Reach', "Kraken's Maw", "Serpent's Spine"],
    islandNames: ['Skull Rock', 'Pelican Point', 'Coral Cay', 'Driftwood Isle', 'Anchor Bay', 'Parrot Perch', 'Barnacle Reef', 'Tidecrest'],
    townNames: ['Port Raven', 'Rusty Anchor', "The Crow's Nest", 'Blackwater Harbor', "Smuggler's Den", "Quartermaster's Rest"],
    oceanNames: ['The Sargasso Deep', 'Calm Waters', 'Northern Passage', "The Devil's Strait", 'Whispering Tides'],
    landmarks: ['Here Be Dragons', 'The Maelstrom', 'Treasure of the Ancients', 'The Sunken Cathedral', 'Ghost Ship Graveyard'],
    treasureNames: ["Blackbeard's Bounty", 'The Lost Doubloons', "Captain Kidd's Cache", 'Chest of the Damned', "The Siren's Gold", 'Pieces of Eight Hoard', "The Phantom's Fortune", "Dead Man's Stash"],
  },
  {
    id: 'frozen-north',
    name: 'Frozen North',
    emoji: '❄️',
    landFills: ['#e8f4f8', '#b0c4de', '#778899', '#a0b0c0', '#d0e8f0'],
    waterFill: '#4a7fa5',
    accentColor: '#2c5f7a',
    continentNames: ['The Glacial Expanse', 'Frostfall Peninsula', 'Iceberg Archipelago', 'The Frozen Wastes', 'Tundra Coast'],
    islandNames: ['Frostbite Isle', 'Glacier Point', 'Aurora Cay', 'Snowbound Rock', 'Ice Palace Bay', 'Polar Perch', 'Frozen Reef', 'Blizzard Key'],
    townNames: ['Frostholm', 'Icebreaker Bay', 'The Frozen Anchor', 'Glacierport', 'Coldwater Cove', 'Snowhaven'],
    oceanNames: ['The Arctic Deep', 'Frozen Passage', 'Northern Drift', 'Ice Strait', 'Polar Currents'],
    landmarks: ['The Ice Citadel', 'Frozen Titan', 'The Frost Vaults', 'Ancient Ice Cave', 'The Eternal Storm'],
    treasureNames: ['The Glacial Hoard', "Frostborn King's Gold", 'Vault of the Ice Witch', 'The Frozen Armory', 'Tundra Burial Cache', 'Crystal Relics of the North', 'The Permafrost Chest', 'Aurora Jewels'],
  },
  {
    id: 'volcanic-chain',
    name: 'Volcanic Chain',
    emoji: '🌋',
    landFills: ['#8b0000', '#cd853f', '#a0522d', '#696969', '#d2691e'],
    waterFill: '#1a6b8a',
    accentColor: '#8b2500',
    continentNames: ['The Fire Islands', 'Ember Reach', 'Lava Spire Chain', 'Scorched Atoll', 'Magma Peninsula'],
    islandNames: ['Cinder Rock', 'Ash Cape', 'Ember Isle', 'Lava Flow Key', 'Caldera Bay', 'Obsidian Perch', 'Forge Reef', 'Smelter Cay'],
    townNames: ['Ironport', 'Ashfall Harbor', 'The Forge', 'Ember Town', 'Cinder Cove', 'Lavawatch'],
    oceanNames: ['The Boiling Sea', 'Ash Waters', 'Sulfur Strait', 'The Scorching Deep', 'Flame Currents'],
    landmarks: ['The Great Eruption', 'Lava God Temple', 'The Eternal Forge', 'Obsidian Cathedral', 'Fire Drake Lair'],
    treasureNames: ['The Molten Vault', "Cinder King's Hoard", 'The Obsidian Cache', 'Fire Drake Plunder', 'Ash Burial Chest', 'The Forge Relics', 'Lava God Offerings', 'Ember Crown Jewels'],
  },
]
