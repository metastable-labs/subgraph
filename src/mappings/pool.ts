import { BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { Swap, Mint, Burn } from '../../generated/templates/Pool/Pool';
import {
  Pool,
  Token,
  Transaction,
  Mint as MintEvent,
  Burn as BurnEvent,
  Swap as SwapEvent,
  AerodromeFactory,
} from '../../generated/schema';
import { PoolFactory } from '../../generated/PoolFactory/PoolFactory';
import { ERC20 } from '../../generated/PoolFactory/ERC20';
import { FACTORY_ADDRESS, ZERO_BI, ONE_BI, ZERO_BD } from './constants';
import {
  updateAerodromeDayData,
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
} from './dayUpdates';

function formatTokenAmount(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return amount.toBigDecimal().div(scale);
}

export function handleSwap(event: Swap): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool === null) return;

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 === null || token1 === null) return;

  // Format amounts using token decimals
  let amount0In = formatTokenAmount(event.params.amount0In, token0.decimals);
  let amount1In = formatTokenAmount(event.params.amount1In, token1.decimals);
  let amount0Out = formatTokenAmount(event.params.amount0Out, token0.decimals);
  let amount1Out = formatTokenAmount(event.params.amount1Out, token1.decimals);

  let amount0Total = amount0In.plus(amount0Out);
  let amount1Total = amount1In.plus(amount1Out);

  // Token updates
  token0.tradeVolume = token0.tradeVolume.plus(amount0Total);
  token1.tradeVolume = token1.tradeVolume.plus(amount1Total);
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);

  // Pool updates
  pool.volumeToken0 = pool.volumeToken0.plus(amount0Total);
  pool.volumeToken1 = pool.volumeToken1.plus(amount1Total);
  pool.txCount = pool.txCount.plus(ONE_BI);

  // Save entities
  pool.save();
  token0.save();
  token1.save();

  // Factory updates
  let factory = AerodromeFactory.load(FACTORY_ADDRESS);
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI);
    factory.save();
  }

  // Transaction tracking
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }

  // Create swap event
  let swaps = transaction.swaps;
  let swap = new SwapEvent(
    event.transaction.hash
      .toHexString()
      .concat('-')
      .concat(BigInt.fromI32(swaps.length).toString()),
  );

  // Populate swap event
  swap.transaction = transaction.id;
  swap.pool = pool.id;
  swap.timestamp = transaction.timestamp;
  swap.sender = event.params.sender;
  swap.from = event.transaction.from;
  swap.amount0In = amount0In;
  swap.amount1In = amount1In;
  swap.amount0Out = amount0Out;
  swap.amount1Out = amount1Out;
  swap.to = event.params.to;
  swap.logIndex = event.logIndex;

  // Save swap and update transaction
  swap.save();
  swaps.push(swap.id);
  transaction.swaps = swaps;
  transaction.save();

  // Update aggregated stats
  let poolDayData = updatePoolDayData(event);
  let poolHourData = updatePoolHourData(event);
  let token0DayData = updateTokenDayData(token0, event);
  let token1DayData = updateTokenDayData(token1, event);

  // Update volumes
  poolDayData.dailyVolumeToken0 = poolDayData.dailyVolumeToken0.plus(amount0Total);
  poolDayData.dailyVolumeToken1 = poolDayData.dailyVolumeToken1.plus(amount1Total);
  poolDayData.save();

  poolHourData.hourlyVolumeToken0 = poolHourData.hourlyVolumeToken0.plus(amount0Total);
  poolHourData.hourlyVolumeToken1 = poolHourData.hourlyVolumeToken1.plus(amount1Total);
  poolHourData.save();

  token0DayData.dailyVolumeToken = token0DayData.dailyVolumeToken.plus(amount0Total);
  token1DayData.dailyVolumeToken = token1DayData.dailyVolumeToken.plus(amount1Total);
  token0DayData.save();
  token1DayData.save();
}

export function handleMint(event: Mint): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool === null) return;

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 === null || token1 === null) return;

  // Format amounts
  let amount0 = formatTokenAmount(event.params.amount0, token0.decimals);
  let amount1 = formatTokenAmount(event.params.amount1, token1.decimals);

  // Update pool liquidity
  let liquidityToken = ERC20.bind(event.address);
  let totalSupplyResult = liquidityToken.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    pool.totalSupply = formatTokenAmount(totalSupplyResult.value, 18);
  }

  // Update reserves
  pool.reserve0 = pool.reserve0.plus(amount0);
  pool.reserve1 = pool.reserve1.plus(amount1);
  pool.save();

  // Update token liquidity
  token0.totalLiquidity = token0.totalLiquidity.plus(amount0);
  token1.totalLiquidity = token1.totalLiquidity.plus(amount1);
  token0.save();
  token1.save();

  // Transaction tracking
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }

  // Create mint event
  let mints = transaction.mints;
  let mint = new MintEvent(
    event.transaction.hash
      .toHexString()
      .concat('-')
      .concat(BigInt.fromI32(mints.length).toString()),
  );

  // Populate mint event
  mint.transaction = transaction.id;
  mint.pool = pool.id;
  mint.timestamp = transaction.timestamp;
  mint.to = event.params.sender;
  mint.sender = event.params.sender;
  mint.amount0 = amount0;
  mint.amount1 = amount1;
  mint.logIndex = event.logIndex;

  // Save mint and update transaction
  mint.save();
  mints.push(mint.id);
  transaction.mints = mints;
  transaction.save();

  // Update aggregated stats
  updatePoolDayData(event);
  updatePoolHourData(event);
  updateTokenDayData(token0, event);
  updateTokenDayData(token1, event);
}

export function handleBurn(event: Burn): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool === null) return;

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 === null || token1 === null) return;

  // Format amounts
  let amount0 = formatTokenAmount(event.params.amount0, token0.decimals);
  let amount1 = formatTokenAmount(event.params.amount1, token1.decimals);

  // Update pool liquidity
  let liquidityToken = ERC20.bind(event.address);
  let totalSupplyResult = liquidityToken.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    pool.totalSupply = formatTokenAmount(totalSupplyResult.value, 18);
  }

  // Update reserves
  pool.reserve0 = pool.reserve0.minus(amount0);
  pool.reserve1 = pool.reserve1.minus(amount1);
  pool.save();

  // Update token liquidity
  token0.totalLiquidity = token0.totalLiquidity.minus(amount0);
  token1.totalLiquidity = token1.totalLiquidity.minus(amount1);
  token0.save();
  token1.save();

  // Transaction tracking
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }

  // Create burn event
  let burns = transaction.burns;
  let burn = new BurnEvent(
    event.transaction.hash
      .toHexString()
      .concat('-')
      .concat(BigInt.fromI32(burns.length).toString()),
  );

  // Populate burn event
  burn.transaction = transaction.id;
  burn.pool = pool.id;
  burn.timestamp = transaction.timestamp;
  burn.sender = event.params.sender;
  burn.to = event.params.to;
  burn.amount0 = amount0;
  burn.amount1 = amount1;
  burn.logIndex = event.logIndex;

  // Save burn and update transaction
  burn.save();
  burns.push(burn.id);
  transaction.burns = burns;
  transaction.save();

  // Update aggregated stats
  updatePoolDayData(event);
  updatePoolHourData(event);
  updateTokenDayData(token0, event);
  updateTokenDayData(token1, event);
}
