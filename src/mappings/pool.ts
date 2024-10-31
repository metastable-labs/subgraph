import { BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { Swap, Mint, Burn, Sync } from '../../generated/templates/Pool/Pool';
import {
  Pool,
  Token,
  Transaction,
  Mint as MintEvent,
  Burn as BurnEvent,
  Swap as SwapEvent,
  AerodromeFactory,
} from '../../generated/schema';
import { FACTORY_ADDRESS, ZERO_BI, ONE_BI, ZERO_BD } from './constants';
import {
  updateAerodromeDayData,
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
} from './dayUpdates';
import { ERC20 } from '../../generated/PoolFactory/ERC20';

function formatTokenAmount(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return amount.toBigDecimal().div(scale);
}

export function handleSync(event: Sync): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool === null) return;

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 === null || token1 === null) return;

  // Get current reserves
  let oldReserve0 = pool.reserve0;
  let oldReserve1 = pool.reserve1;

  // Update to new reserves with proper decimal formatting
  let newReserve0 = formatTokenAmount(event.params.reserve0, token0.decimals);
  let newReserve1 = formatTokenAmount(event.params.reserve1, token1.decimals);

  // Calculate reserve changes
  let reserve0Delta = newReserve0.minus(oldReserve0);
  let reserve1Delta = newReserve1.minus(oldReserve1);

  // Update pool reserves
  pool.reserve0 = newReserve0;
  pool.reserve1 = newReserve1;

  // Update token total liquidity
  token0.totalLiquidity = token0.totalLiquidity.plus(reserve0Delta);
  token1.totalLiquidity = token1.totalLiquidity.plus(reserve1Delta);

  // Ensure liquidity never goes negative
  if (token0.totalLiquidity.lt(ZERO_BD)) {
    token0.totalLiquidity = ZERO_BD;
  }
  if (token1.totalLiquidity.lt(ZERO_BD)) {
    token1.totalLiquidity = ZERO_BD;
  }

  // Save all entities
  pool.save();
  token0.save();
  token1.save();

  // Update aggregate data
  updatePoolDayData(event);
  updatePoolHourData(event);
  updateTokenDayData(token0, event);
  updateTokenDayData(token1, event);
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

  // Update token stats
  token0.tradeVolume = token0.tradeVolume.plus(amount0Total);
  token0.txCount = token0.txCount.plus(ONE_BI);

  token1.tradeVolume = token1.tradeVolume.plus(amount1Total);
  token1.txCount = token1.txCount.plus(ONE_BI);

  // Update pool stats
  pool.volumeToken0 = pool.volumeToken0.plus(amount0Total);
  pool.volumeToken1 = pool.volumeToken1.plus(amount1Total);
  pool.txCount = pool.txCount.plus(ONE_BI);

  // Note: Don't update reserves here as they will be updated by the Sync event

  pool.save();
  token0.save();
  token1.save();

  // Update factory stats
  let factory = AerodromeFactory.load(FACTORY_ADDRESS);
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI);
    factory.save();
  }

  // Create and save transaction
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }

  let swaps = transaction.swaps;
  let swap = new SwapEvent(
    event.transaction.hash.toHexString() + '-' + BigInt.fromI32(swaps.length).toString(),
  );

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

  swap.save();
  swaps.push(swap.id);
  transaction.swaps = swaps;
  transaction.save();

  // Update aggregate data
  let poolDayData = updatePoolDayData(event);
  let poolHourData = updatePoolHourData(event);
  let token0DayData = updateTokenDayData(token0, event);
  let token1DayData = updateTokenDayData(token1, event);

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

  // Format amounts using token decimals
  let amount0 = formatTokenAmount(event.params.amount0, token0.decimals);
  let amount1 = formatTokenAmount(event.params.amount1, token1.decimals);

  // Update token txn counts
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);

  // Update pool txn count
  pool.txCount = pool.txCount.plus(ONE_BI);

  // Get fresh total supply from contract
  let poolContract = ERC20.bind(event.address);
  let totalSupplyResult = poolContract.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    pool.totalSupply = formatTokenAmount(totalSupplyResult.value, 18);
  }

  // Save updates
  pool.save();
  token0.save();
  token1.save();

  // Create and save transaction
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }

  // Create new mint event
  let mints = transaction.mints;
  let mint = new MintEvent(
    event.transaction.hash.toHexString() + '-' + BigInt.fromI32(mints.length).toString(),
  );

  // Populate mint event
  mint.transaction = transaction.id;
  mint.pool = pool.id;
  mint.timestamp = transaction.timestamp;
  mint.sender = event.params.sender;
  mint.to = event.params.sender; // In Aerodrome, sender is the recipient of the minted tokens
  mint.amount0 = amount0;
  mint.amount1 = amount1;
  mint.logIndex = event.logIndex;

  // Save mint and update transaction
  mint.save();
  mints.push(mint.id);
  transaction.mints = mints;
  transaction.save();

  // Update factory
  let factory = AerodromeFactory.load(FACTORY_ADDRESS);
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI);
    factory.save();
  }

  // Update aggregated data
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

  // Format amounts using token decimals
  let amount0 = formatTokenAmount(event.params.amount0, token0.decimals);
  let amount1 = formatTokenAmount(event.params.amount1, token1.decimals);

  // Update token txn counts
  token0.txCount = token0.txCount.plus(ONE_BI);
  token1.txCount = token1.txCount.plus(ONE_BI);

  // Update pool txn count
  pool.txCount = pool.txCount.plus(ONE_BI);

  // Get fresh total supply from contract
  let poolContract = ERC20.bind(event.address);
  let totalSupplyResult = poolContract.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    pool.totalSupply = formatTokenAmount(totalSupplyResult.value, 18); // LP tokens always have 18 decimals
  }

  // Save updates
  pool.save();
  token0.save();
  token1.save();

  // Create and save transaction
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }

  // Create new burn event
  let burns = transaction.burns;
  let burn = new BurnEvent(
    event.transaction.hash.toHexString() + '-' + BigInt.fromI32(burns.length).toString(),
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

  // Update factory
  let factory = AerodromeFactory.load(FACTORY_ADDRESS);
  if (factory !== null) {
    factory.txCount = factory.txCount.plus(ONE_BI);
    factory.save();
  }

  // Update aggregated data
  updatePoolDayData(event);
  updatePoolHourData(event);
  updateTokenDayData(token0, event);
  updateTokenDayData(token1, event);
}
