import type {
  Archetype,
  Breakdown,
  PositionContribution,
  UserProfile,
  UserScore,
} from '@hyperunicorn/core';

type SignalKey = keyof Breakdown;

const SIGNAL_META: Record<SignalKey, { short: string; name: string }> = {
  vault: { short: 'V', name: 'Vault' },
  directLp: { short: 'D', name: 'Direct Positions' },
  taker: { short: 'F', name: 'Funding Demand' },
};

export function getSignalName(key: SignalKey): string {
  return SIGNAL_META[key].name;
}

export function getSignalShortLabel(key: SignalKey): string {
  return SIGNAL_META[key].short;
}

export function getDisplayUserLabel(profile: UserProfile): string {
  switch (profile.archetype) {
    case 'ACTIVE_LP':
      return 'Active direct positions';
    case 'PARKED_LP':
      return 'Wide direct positions';
    case 'PERP_BUYER_LONG':
      return 'Funding-demand buyer';
    default:
      return profile.label;
  }
}

export function getActivityTypeLabel(archetype: Archetype): string {
  switch (archetype) {
    case 'WHALE_VAULT':
    case 'STEADY_VAULT':
      return 'Vault activity';
    case 'HYBRID':
    case 'FLASH_FARMER':
    case 'NEWCOMER':
      return 'Mixed activity';
    default:
      return 'Direct activity';
  }
}

export function getMockScenarioSummary(archetype: Archetype): string {
  switch (archetype) {
    case 'WHALE_VAULT':
      return 'Mock scenario: a large vault depositor used to show how sticky vault-managed capital scales and how daily saturation trims raw whale dominance.';
    case 'STEADY_VAULT':
      return 'Mock scenario: a steady vault depositor with moderate capital held through the window, plus a later top-up.';
    case 'ACTIVE_LP':
      return 'Mock scenario: repeated user-managed direct positions held for multi-day stretches to show productive direct capital over time.';
    case 'PARKED_LP':
      return 'Mock scenario: wide direct positions held across the full window to test how out-of-range discounts behave when capital stays committed for a long time.';
    case 'PERP_BUYER_LONG':
      return 'Mock scenario: repeated direct exposure held long enough to pay funding and earn demand-side points.';
    case 'HYBRID':
      return 'Mock scenario: mixed vault, direct-position, and funding-demand activity used to show all three scoring signals in one account.';
    case 'FLASH_FARMER':
      return 'Mock scenario: a short-lived farming attempt combining a 24-hour vault burst with a 2-hour direct position, used to show what gets pruned and what only gets saturated in v1.';
    case 'DUST_SPAMMER':
      return 'Mock scenario: many tiny direct positions that all fall below minimum notional and should earn nothing.';
    case 'NEWCOMER':
      return 'Mock scenario: a user who joins halfway through the window, adds more vault capital later, and opens one direct position during the ramp.';
  }
}

export function getPositionKindLabel(kind: PositionContribution['kind']): string {
  return kind === 'LP' ? 'Direct' : 'Funding';
}

export function getWhyThisScoreLines(
  profile: UserProfile,
  score: UserScore,
): string[] {
  const lines: string[] = [];
  const total = score.total;
  const hasSaturation = score.rawTotal - score.total > 0.5;
  const hasPrunedPositions = score.positions.some((position) => !position.eligible);

  if (total <= 0) {
    lines.push(
      'This user finished with no final score in the window. In the mock data, their activity was intentionally structured to fall below the minimum quality gates.',
    );
  } else {
    switch (profile.archetype) {
      case 'WHALE_VAULT':
        lines.push(
          'This score is almost entirely vault-managed capital. The mock user holds a very large vault deposit for nearly the full window, so they dominate raw points before daily saturation reduces the total.',
        );
        break;
      case 'STEADY_VAULT':
        lines.push(
          'This score comes from vault-managed capital held consistently across the window, with a later top-up increasing the pace in the second half.',
        );
        break;
      case 'ACTIVE_LP':
        lines.push(
          'This score comes from repeated direct positions that stayed open for multi-day stretches. The user earns by keeping direct capital productive over time rather than by churning events.',
        );
        break;
      case 'PARKED_LP':
        lines.push(
          'This score comes from direct positions that were held open across almost the entire window. The scenario tests out-of-range discounts, but in this generated price path some of those wide positions still stayed productive for long stretches, so the user still scores highly.',
        );
        break;
      case 'PERP_BUYER_LONG':
        lines.push(
          'This score comes almost entirely from funding demand. The user repeatedly holds exposure and earns only while paying funding.',
        );
        break;
      case 'HYBRID':
        if (isBalancedMix(score.breakdown)) {
          lines.push(
            'This user has a balanced score across vault deposits, direct positions, and funding demand, which is the healthiest mixed activity pattern in the mock data.',
          );
        } else {
          lines.push(
            'This user touches all three scoring signals, but the score is not evenly split: vault-managed capital is still the largest driver, with smaller contributions from direct positions and funding demand.',
          );
        }
        break;
      case 'FLASH_FARMER':
        lines.push(
          'This mock user is meant to show burst farming limits. Their 2-hour direct position was pruned entirely, but the 24-hour vault burst still earned points in v1 and was only reduced by daily saturation.',
        );
        break;
      case 'DUST_SPAMMER':
        lines.push(
          'This mock user is meant to show minimum-notional pruning. They opened many tiny direct positions, but none were large enough to count.',
        );
        break;
      case 'NEWCOMER':
        lines.push(
          'This score comes from activity that starts halfway through the window. The user ramps up with vault deposits first, then adds one direct position, so the curve starts late and accelerates.',
        );
        break;
      default:
        if (isBalancedMix(score.breakdown)) {
          lines.push(
            'This user has a balanced score across vault deposits, direct positions, and funding demand, which is the healthiest mixed activity pattern in the mock data.',
          );
        } else {
          switch (getDominantSignal(score.breakdown)) {
            case 'vault':
              lines.push(
                'Most of this user’s score comes from vault-managed capital. Their capital stayed active over time, which is rewarded by the capital-time scoring model.',
              );
              break;
            case 'directLp':
              lines.push(
                'Most of this user’s score comes from direct positions. These points come from user-managed position capital that stayed open and productive over time.',
              );
              break;
            case 'taker':
              lines.push(
                'Most of this user’s score comes from funding demand. This means they created real protocol demand by paying funding while holding exposure.',
              );
              break;
            default:
              lines.push(
                'This score is spread across multiple signals rather than being driven by one activity pattern.',
              );
              break;
          }
        }
        break;
    }
  }

  if (hasSaturation) {
    lines.push(
      'Daily saturation reduced part of their raw score, limiting single-wallet dominance.',
    );
  }

  if (
    hasPrunedPositions &&
    profile.archetype !== 'FLASH_FARMER' &&
    profile.archetype !== 'DUST_SPAMMER'
  ) {
    lines.push(
      'Some positions were pruned because they failed minimum duration or minimum notional requirements.',
    );
  }

  if (score.positions.length === 0 && score.breakdown.vault > 0) {
    lines.push(
      'There are no direct-position or funding-demand entries below because this user participated only through the vault in this window.',
    );
  }

  return lines;
}

function getDominantSignal(breakdown: Breakdown): SignalKey | null {
  const entries = Object.entries(breakdown) as Array<[SignalKey, number]>;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return null;

  let dominant: [SignalKey, number] | null = null;
  for (const entry of entries) {
    if (!dominant || entry[1] > dominant[1]) dominant = entry;
  }
  return dominant?.[0] ?? null;
}

function isBalancedMix(breakdown: Breakdown): boolean {
  const entries = Object.entries(breakdown) as Array<[SignalKey, number]>;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return false;

  const shares = entries.map(([, value]) => value / total);
  const allContribute = shares.every((share) => share > 0.08);
  const maxShare = Math.max(...shares);
  return allContribute && maxShare <= 0.7;
}
