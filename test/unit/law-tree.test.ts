import { describe, expect, it } from 'vitest'
import { LAW_TREE, getLaw, getAvailableLaws } from '../../shared/law-tree'
import { FACTION_IDS } from '../../shared/game-types'

describe('law-tree', () => {
  describe('LAW_TREE structure', () => {
    it('has common laws in 4 branches', () => {
      const common = Object.values(LAW_TREE).filter(l => !l.factionOnly)
      const branches = new Set(common.map(l => l.branch))
      expect(branches.size).toBe(4) // economy, military, society, diplomacy
      expect(branches).toContain('economy')
      expect(branches).toContain('military')
      expect(branches).toContain('society')
      expect(branches).toContain('diplomacy')
    })

    it('each faction has 3 unique laws', () => {
      for (const fid of FACTION_IDS) {
        const laws = Object.values(LAW_TREE).filter(l => l.factionOnly === fid)
        expect(laws).toHaveLength(3)
      }
    })

    it('all faction-unique laws have branch "faction_unique"', () => {
      const factionLaws = Object.values(LAW_TREE).filter(l => l.factionOnly)
      for (const law of factionLaws) {
        expect(law.branch).toBe('faction_unique')
      }
    })

    it('every law has a positive cultureCost', () => {
      for (const law of Object.values(LAW_TREE)) {
        expect(law.cultureCost).toBeGreaterThan(0)
      }
    })

    it('every law has at least one effect', () => {
      for (const law of Object.values(LAW_TREE)) {
        expect(law.effects.length).toBeGreaterThan(0)
      }
    })

    it('every law has id matching its key in LAW_TREE', () => {
      for (const [key, law] of Object.entries(LAW_TREE)) {
        expect(law.id).toBe(key)
      }
    })

    it('all requires references point to existing laws', () => {
      for (const law of Object.values(LAW_TREE)) {
        for (const reqId of law.requires) {
          expect(LAW_TREE[reqId]).toBeDefined()
        }
      }
    })
  })

  describe('getLaw', () => {
    it('returns a law by id', () => {
      const law = getLaw('taxation')
      expect(law.id).toBe('taxation')
      expect(law.branch).toBe('economy')
    })

    it('throws for unknown law id', () => {
      expect(() => getLaw('nonexistent')).toThrow()
    })
  })

  describe('getAvailableLaws', () => {
    it('returns root laws when nothing passed', () => {
      const available = getAvailableLaws([], 'solar_empire')
      const ids = available.map(l => l.id)
      expect(ids).toContain('taxation')
      expect(ids).toContain('mobilization')
      expect(ids).not.toContain('free_trade') // requires taxation
    })

    it('diplomacy laws (declare_war) are always available', () => {
      const available = getAvailableLaws([], 'solar_empire')
      expect(available.find(l => l.id === 'declare_war')).toBeDefined()
    })

    it('unlocks dependent laws when prerequisite is passed', () => {
      const available = getAvailableLaws(['taxation'], 'solar_empire')
      const ids = available.map(l => l.id)
      expect(ids).toContain('free_trade')
      expect(ids).toContain('monopoly')
      // taxation itself should not appear (already passed)
      expect(ids).not.toContain('taxation')
    })

    it('does not include already-passed laws', () => {
      const available = getAvailableLaws(['taxation', 'free_trade'], 'solar_empire')
      const ids = available.map(l => l.id)
      expect(ids).not.toContain('taxation')
      expect(ids).not.toContain('free_trade')
    })

    it('includes own faction unique root laws', () => {
      const available = getAvailableLaws([], 'solar_empire')
      const ids = available.map(l => l.id)
      expect(ids).toContain('imperial_conscription')
    })

    it('excludes other faction unique laws', () => {
      const available = getAvailableLaws([], 'solar_empire')
      const ids = available.map(l => l.id)
      expect(ids).not.toContain('gold_standard') // merchant_league
      expect(ids).not.toContain('law_of_the_forest') // forest_keepers
      expect(ids).not.toContain('academic_exchange') // seekers
    })

    it('unlocks faction unique chain when prerequisite is passed', () => {
      const available = getAvailableLaws(['imperial_conscription'], 'solar_empire')
      const ids = available.map(l => l.id)
      expect(ids).toContain('pax_solaris')
      expect(ids).not.toContain('imperial_conscription')
    })

    it('society branch root laws are available without prerequisites', () => {
      const available = getAvailableLaws([], 'seekers')
      const ids = available.map(l => l.id)
      expect(ids).toContain('festivals')
      expect(ids).toContain('education')
      expect(ids).toContain('expansionism')
    })

    it('diplomacy laws with targetPlayer flag are present', () => {
      const available = getAvailableLaws([], 'merchant_league')
      const diplomacyLaws = available.filter(l => l.targetPlayer)
      const ids = diplomacyLaws.map(l => l.id)
      expect(ids).toContain('declare_war')
      expect(ids).toContain('propose_peace')
      expect(ids).toContain('trade_embargo')
    })
  })
})
