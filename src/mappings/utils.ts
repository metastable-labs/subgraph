import { BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { ZERO_BD } from './constants';

const BASIS_POINTS = BigDecimal.fromString('10000'); // 100%

export function formatFeePercent(fee: BigInt): BigDecimal {
  // Convert fee basis points to percentage
  // fee of 30 -> 0.3%
  // fee of 5 -> 0.05%
  return fee.toBigDecimal().div(BASIS_POINTS);
}
