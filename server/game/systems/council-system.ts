import type { GameState, AdvisorVote, AdvisorType, Advisor, GamePlayer, LawNode } from '../../../shared/game-types'
import { getLaw, getAvailableLaws } from '../../../shared/law-tree'

export interface LawProposalResult {
  passed: boolean
  votes: AdvisorVote[]
  lawId: string
}

/**
 * Propose a law for council vote. Validates prerequisites and culture cost,
 * deducts culture, then collects advisor votes. If 3+ advisors vote yes,
 * the law passes and its effects are applied.
 */
export function proposeLaw(
  playerId: string,
  lawId: string,
  state: GameState,
  targetPlayerId?: string
): LawProposalResult {
  const player = state.players.get(playerId)!
  const law = getLaw(lawId)

  // Validate prerequisites
  const available = getAvailableLaws(player.passedLaws, player.factionId)
  if (!available.find(l => l.id === lawId)) {
    throw new Error('Law prerequisites not met')
  }

  // Validate culture cost
  if (player.resources.culture < law.cultureCost) {
    throw new Error('Not enough culture')
  }

  // Deduct culture cost
  player.resources.culture -= law.cultureCost

  // Each advisor votes
  const votes = getAdvisorVotes(player, law, state)
  const yesCount = votes.filter(v => v.vote === 'yes').length
  const passed = yesCount >= 3

  if (passed) {
    player.passedLaws.push(lawId)
    applyLawEffects(player, law, state, targetPlayerId)
  }

  return { passed, votes, lawId }
}

// --- Advisor voting logic ---

/**
 * Threshold for "many warriors": 3 or more warrior units.
 */
const STRONG_ARMY_THRESHOLD = 3

/**
 * Collect votes from all 5 advisors for a proposed law.
 * Each advisor votes based on their domain expertise, current conditions,
 * and their loyalty level.
 */
function getAdvisorVotes(player: GamePlayer, law: LawNode, state: GameState): AdvisorVote[] {
  return player.advisors.map(advisor => getAdvisorVote(advisor, player, law, state))
}

/**
 * Determine a single advisor's vote.
 *
 * High loyalty (70+) makes an advisor vote yes more easily.
 * Low loyalty (<30) makes an advisor vote no unless conditions are great.
 */
function getAdvisorVote(
  advisor: Advisor,
  player: GamePlayer,
  law: LawNode,
  state: GameState
): AdvisorVote {
  const loyalty = advisor.loyalty

  switch (advisor.type) {
    case 'general':
      return voteGeneral(loyalty, player, law, state)
    case 'treasurer':
      return voteTreasurer(loyalty, player, law)
    case 'priest':
      return votePriest(loyalty, player, law)
    case 'scholar':
      return voteScholar(loyalty, player, law)
    case 'tribune':
      return voteTribune(loyalty, player, law, state)
  }
}

/**
 * Count warrior units owned by a player.
 */
function countWarriors(playerId: string, state: GameState): number {
  let count = 0
  for (const unit of state.units.values()) {
    if (unit.ownerId === playerId && unit.type === 'warrior') {
      count++
    }
  }
  return count
}

/**
 * Check if a law has any effect that penalizes science (modifier < 1).
 */
function hasSciencePenalty(law: LawNode): boolean {
  return law.effects.some(
    e => e.type === 'resource_modifier' && e.target === 'science' && e.value !== undefined && e.value < 1
  )
}

/**
 * Check if player is at war with anyone.
 */
function isAtWar(playerId: string, state: GameState): boolean {
  return state.diplomacy.some(
    d => (d.player1Id === playerId || d.player2Id === playerId) && d.status === 'war'
  )
}

// --- Individual advisor vote functions ---

function voteGeneral(loyalty: number, player: GamePlayer, law: LawNode, state: GameState): AdvisorVote {
  const warriors = countWarriors(player.userId, state)
  const strongArmy = warriors >= STRONG_ARMY_THRESHOLD
  const isMilitary = law.branch === 'military'

  // High loyalty: yes if military + strong army, or just high loyalty in general
  if (loyalty >= 70) {
    if (isMilitary && strongArmy) {
      return { advisor: 'general', vote: 'yes', reason: 'Strong army supports military law' }
    }
    // High loyalty general is amenable even to non-military laws
    return { advisor: 'general', vote: 'yes', reason: 'High loyalty supports proposal' }
  }

  // Normal loyalty
  if (isMilitary && strongArmy) {
    return { advisor: 'general', vote: 'yes', reason: 'Army is strong, supports military law' }
  }

  // Low loyalty: votes no unless conditions are great
  if (loyalty < 30) {
    return { advisor: 'general', vote: 'no', reason: 'Low loyalty, opposes proposal' }
  }

  // Middle loyalty: votes based on whether law is military + army status
  if (isMilitary && !strongArmy) {
    return { advisor: 'general', vote: 'no', reason: 'Weak army, opposes military expansion' }
  }

  // Neutral stance for non-military laws at mid loyalty
  return { advisor: 'general', vote: 'yes', reason: 'No strong objection' }
}

function voteTreasurer(loyalty: number, player: GamePlayer, law: LawNode): AdvisorVote {
  const goldPositive = player.resources.gold > 0
  const isEconomy = law.branch === 'economy'

  // Gold deficit: votes no
  if (!goldPositive) {
    return { advisor: 'treasurer', vote: 'no', reason: 'Gold deficit, opposes spending' }
  }

  // High loyalty: yes for economy laws, or generally supportive
  if (loyalty >= 70) {
    if (isEconomy) {
      return { advisor: 'treasurer', vote: 'yes', reason: 'Economy law with healthy treasury' }
    }
    return { advisor: 'treasurer', vote: 'yes', reason: 'High loyalty supports proposal' }
  }

  // Normal loyalty with gold > 0
  if (isEconomy) {
    return { advisor: 'treasurer', vote: 'yes', reason: 'Supports economy law' }
  }

  // Low loyalty: votes no unless economy is great
  if (loyalty < 30) {
    return { advisor: 'treasurer', vote: 'no', reason: 'Low loyalty, opposes proposal' }
  }

  // Mid loyalty, non-economy law, gold positive
  return { advisor: 'treasurer', vote: 'yes', reason: 'Treasury is healthy' }
}

function votePriest(loyalty: number, player: GamePlayer, law: LawNode): AdvisorVote {
  const cultureFlowing = player.resourceIncome.culture > 0
  const isSociety = law.branch === 'society'
  const isMilitary = law.branch === 'military'

  // High loyalty: yes for society/culture laws, generally supportive
  if (loyalty >= 70) {
    if (isSociety && cultureFlowing) {
      return { advisor: 'priest', vote: 'yes', reason: 'Culture flourishing, supports society law' }
    }
    if (isMilitary) {
      return { advisor: 'priest', vote: 'no', reason: 'Opposes aggressive military law' }
    }
    return { advisor: 'priest', vote: 'yes', reason: 'High loyalty supports proposal' }
  }

  // Society law with culture flowing: yes
  if (isSociety && cultureFlowing) {
    return { advisor: 'priest', vote: 'yes', reason: 'Culture is flowing, supports society law' }
  }

  // Aggressive military laws: no
  if (isMilitary) {
    return { advisor: 'priest', vote: 'no', reason: 'Opposes military aggression' }
  }

  // Low loyalty: votes no
  if (loyalty < 30) {
    return { advisor: 'priest', vote: 'no', reason: 'Low loyalty, opposes proposal' }
  }

  // Mid loyalty: mild support
  if (cultureFlowing) {
    return { advisor: 'priest', vote: 'yes', reason: 'Culture is flowing' }
  }

  return { advisor: 'priest', vote: 'no', reason: 'Culture stagnating' }
}

function voteScholar(loyalty: number, player: GamePlayer, law: LawNode): AdvisorVote {
  const penalizesScience = hasSciencePenalty(law)

  // Science penalty: no (unless very high loyalty)
  if (penalizesScience) {
    if (loyalty >= 90) {
      return { advisor: 'scholar', vote: 'yes', reason: 'Very high loyalty overrides science concerns' }
    }
    return { advisor: 'scholar', vote: 'no', reason: 'Law penalizes science' }
  }

  // High loyalty: yes
  if (loyalty >= 70) {
    return { advisor: 'scholar', vote: 'yes', reason: 'High loyalty, no science penalty' }
  }

  // Low loyalty: no
  if (loyalty < 30) {
    return { advisor: 'scholar', vote: 'no', reason: 'Low loyalty, opposes proposal' }
  }

  // Mid loyalty, no science penalty: yes
  return { advisor: 'scholar', vote: 'yes', reason: 'No objection to this law' }
}

function voteTribune(loyalty: number, player: GamePlayer, law: LawNode, state: GameState): AdvisorVote {
  const foodPositive = player.resources.food > 0
  const atWar = isAtWar(player.userId, state)

  // Famine: always no
  if (!foodPositive) {
    return { advisor: 'tribune', vote: 'no', reason: 'People are starving' }
  }

  // At war: no (people suffer during war)
  if (atWar) {
    if (loyalty >= 70) {
      // High loyalty tribune might reluctantly support during war
      return { advisor: 'tribune', vote: 'yes', reason: 'High loyalty supports during wartime' }
    }
    return { advisor: 'tribune', vote: 'no', reason: 'People suffer during war' }
  }

  // High loyalty + food + no war: yes
  if (loyalty >= 70) {
    return { advisor: 'tribune', vote: 'yes', reason: 'People prosper, high loyalty' }
  }

  // Low loyalty: no
  if (loyalty < 30) {
    return { advisor: 'tribune', vote: 'no', reason: 'Low loyalty, opposes proposal' }
  }

  // Mid loyalty, food positive, no war: yes
  return { advisor: 'tribune', vote: 'yes', reason: 'People are content' }
}

// --- Law effects application ---

/**
 * Apply the effects of a passed law to the player's state.
 * Handles loyalty_change and diplomacy_change effects immediately.
 * Resource/unit/settlement modifiers are stored via passedLaws and
 * checked by external systems during calculation.
 */
function applyLawEffects(
  player: GamePlayer,
  law: LawNode,
  state: GameState,
  targetPlayerId?: string
): void {
  for (const effect of law.effects) {
    switch (effect.type) {
      case 'loyalty_change':
        applyLoyaltyChange(player, effect.target as AdvisorType | undefined, effect.value ?? 0)
        break
      case 'diplomacy_change':
        if (targetPlayerId && effect.target) {
          applyDiplomacyChange(player.userId, targetPlayerId, effect.target, state)
        }
        break
      // resource_modifier, unit_modifier, settlement_modifier, special:
      // These are applied by other systems that check player.passedLaws
      // during their per-tick calculations.
    }
  }
}

/**
 * Apply a loyalty change to a specific advisor type, or all advisors if no target.
 * Loyalty is clamped to 0-100.
 */
function applyLoyaltyChange(player: GamePlayer, target: AdvisorType | undefined, value: number): void {
  if (target) {
    const advisor = player.advisors.find(a => a.type === target)
    if (advisor) {
      advisor.loyalty = clampLoyalty(advisor.loyalty + value)
    }
  } else {
    // Apply to all advisors
    for (const advisor of player.advisors) {
      advisor.loyalty = clampLoyalty(advisor.loyalty + value)
    }
  }
}

/**
 * Apply a diplomacy status change between two players.
 */
function applyDiplomacyChange(
  playerId: string,
  targetPlayerId: string,
  newStatus: string,
  state: GameState
): void {
  const relation = state.diplomacy.find(
    d => (d.player1Id === playerId && d.player2Id === targetPlayerId)
      || (d.player1Id === targetPlayerId && d.player2Id === playerId)
  )

  if (relation && (newStatus === 'peace' || newStatus === 'tension' || newStatus === 'war')) {
    relation.status = newStatus
  }
}

// --- Per-tick advisor loyalty updates ---

/**
 * Update advisor loyalty each tick based on domain conditions.
 *
 * - General: +1 if many warriors, -1 if few
 * - Treasurer: +1 if gold positive, -1 if gold negative
 * - Priest: +1 if culture income positive, -1 if low culture
 * - Scholar: +1 if researching, -1 if no research
 * - Tribune: +1 if food positive, -1 if food negative
 */
export function tickAdvisorLoyalty(state: GameState): void {
  for (const [, player] of state.players) {
    if (player.eliminated) continue

    for (const advisor of player.advisors) {
      const delta = getLoyaltyDelta(advisor.type, player, state)
      advisor.loyalty = clampLoyalty(advisor.loyalty + delta)
    }
  }
}

/**
 * Calculate the loyalty change for a given advisor type based on current conditions.
 */
function getLoyaltyDelta(type: AdvisorType, player: GamePlayer, state: GameState): number {
  switch (type) {
    case 'general': {
      const warriors = countWarriors(player.userId, state)
      return warriors >= STRONG_ARMY_THRESHOLD ? 1 : -1
    }
    case 'treasurer':
      return player.resources.gold > 0 ? 1 : -1
    case 'priest':
      return player.resourceIncome.culture > 0 ? 1 : -1
    case 'scholar':
      return player.currentResearch !== null ? 1 : -1
    case 'tribune':
      return player.resources.food > 0 ? 1 : -1
  }
}

/**
 * Clamp a loyalty value to the valid range [0, 100].
 */
function clampLoyalty(value: number): number {
  return Math.max(0, Math.min(100, value))
}
