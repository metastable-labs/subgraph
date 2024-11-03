import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';
import { Pool as PoolContract } from '../../generated/templates/Pool/Pool';
import { Pool, Token } from '../../generated/schema';
import { ZERO_BD } from './constants';

function formatTokenAmount(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return amount.toBigDecimal().div(scale);
}

function calculateTotalFeesUSD(pool: Pool, token0: Token, token1: Token): BigDecimal {
  let fees0USD = pool.claimableToken0.times(token0.usdPrice);
  let fees1USD = pool.claimableToken1.times(token1.usdPrice);
  return fees0USD.plus(fees1USD);
}

export function updatePoolFees(pool: Pool): void {
  let poolContract = PoolContract.bind(Address.fromString(pool.id));
  let token0 = Token.load(pool.token0) as Token;
  let token1 = Token.load(pool.token1) as Token;

  // Get claimable fees for token0
  let claimable0Result = poolContract.try_claimable0(Address.fromString(pool.id));
  if (!claimable0Result.reverted) {
    pool.claimableToken0 = formatTokenAmount(claimable0Result.value, token0.decimals);
  } else {
    pool.claimableToken0 = ZERO_BD;
  }

  // Get claimable fees for token1
  let claimable1Result = poolContract.try_claimable1(Address.fromString(pool.id));
  if (!claimable1Result.reverted) {
    pool.claimableToken1 = formatTokenAmount(claimable1Result.value, token1.decimals);
  } else {
    pool.claimableToken1 = ZERO_BD;
  }
  // Calculate total fees in USD
  pool.totalFeesUSD = calculateTotalFeesUSD(pool, token0, token1);
}
