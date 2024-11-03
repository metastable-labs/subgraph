import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';
import { LPSugar } from '../../generated/PoolFactory/LPSugar';
import { Pool } from '../../generated/schema';
import { ZERO_BD } from './constants';

const LP_SUGAR_ADDRESS = '0x51f290CCCD6a54Af00b38edDd59212dE068B8A4b';
const SECONDS_PER_YEAR = BigInt.fromI32(31536000);

function formatEmissionsToDecimal(amount: BigInt): BigDecimal {
  return amount.toBigDecimal().div(BigInt.fromI32(10).pow(18).toBigDecimal());
}

export function updatePoolEmissions(pool: Pool): void {
  let lpSugar = LPSugar.bind(Address.fromString(LP_SUGAR_ADDRESS));

  // Get latest epoch data
  let epochResult = lpSugar.try_epochsByAddress(
    BigInt.fromI32(1), // limit to 1 (most recent)
    BigInt.fromI32(0), // offset
    Address.fromString(pool.id),
  );

  if (epochResult.reverted) {
    pool.emissionsPerSecond = ZERO_BD;
    return;
  }

  let epochs = epochResult.value;
  if (epochs.length == 0) {
    pool.emissionsPerSecond = ZERO_BD;
    return;
  }

  let latestEpoch = epochs[0];
  // Format emissions rate to proper decimals
  let emissionsPerSecond = formatEmissionsToDecimal(latestEpoch.emissions);

  // Calculate yearly emissions
  let yearlyEmissions = emissionsPerSecond.times(SECONDS_PER_YEAR.toBigDecimal());

  // Update pool
  pool.emissionsPerSecond = emissionsPerSecond;
  pool.yearlyEmissions = yearlyEmissions;
}
