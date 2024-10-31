import { BigInt } from '@graphprotocol/graph-ts';
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
import { ZERO_BD, ONE_BI, FACTORY_ADDRESS, convertTokenToDecimal } from './helpers';
import {
  updateAerodromeDayData,
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
} from './dayUpdates';
import { PoolFactory } from '../../generated/PoolFactory/PoolFactory';
import { ERC20 } from '../../generated/PoolFactory/ERC20';

export function handleSwap(event: Swap): void {
  let pool = Pool.load(event.address.toHexString());
  if (pool === null) return;

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 === null || token1 === null) return;

  let amount0In = convertTokenToDecimal(event.params.amount0In, BigInt.fromI32(token0.decimals));
  let amount1In = convertTokenToDecimal(event.params.amount1In, BigInt.fromI32(token1.decimals));
  let amount0Out = convertTokenToDecimal(event.params.amount0Out, BigInt.fromI32(token0.decimals));
  let amount1Out = convertTokenToDecimal(event.params.amount1Out, BigInt.fromI32(token1.decimals));

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

  pool.save();
  token0.save();
  token1.save();

  // Update factory stats
  let aerodrome = AerodromeFactory.load(FACTORY_ADDRESS);
  if (aerodrome !== null) {
    aerodrome.txCount = aerodrome.txCount.plus(ONE_BI);
    aerodrome.save();
  }

  // Create transaction entity
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

  // Update day and hour data
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
  let poolContract = PoolFactory.bind(event.address);
  if (pool === null) return;

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 === null || token1 === null) return;

  let amount0 = convertTokenToDecimal(event.params.amount0, BigInt.fromI32(token0.decimals));
  let amount1 = convertTokenToDecimal(event.params.amount1, BigInt.fromI32(token1.decimals));

  // Update pool liquidity
  let liquidityToken = ERC20.bind(event.address);
  let totalSupplyResult = liquidityToken.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    pool.totalSupply = convertTokenToDecimal(totalSupplyResult.value, BigInt.fromI32(18));
  }

  pool.reserve0 = pool.reserve0.plus(amount0);
  pool.reserve1 = pool.reserve1.plus(amount1);
  pool.save();

  // Update token liquidity
  token0.totalLiquidity = token0.totalLiquidity.plus(amount0);
  token1.totalLiquidity = token1.totalLiquidity.plus(amount1);
  token0.save();
  token1.save();

  // Create mint event
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }

  let mints = transaction.mints;
  let mint = new MintEvent(
    event.transaction.hash.toHexString() + '-' + BigInt.fromI32(mints.length).toString(),
  );

  mint.transaction = transaction.id;
  mint.pool = pool.id;
  mint.timestamp = transaction.timestamp;
  mint.to = event.params.sender;
  mint.sender = event.params.sender;
  mint.amount0 = amount0;
  mint.amount1 = amount1;
  mint.logIndex = event.logIndex;
  mint.save();

  mints.push(mint.id);
  transaction.mints = mints;
  transaction.save();

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

  let amount0 = convertTokenToDecimal(event.params.amount0, BigInt.fromI32(token0.decimals));
  let amount1 = convertTokenToDecimal(event.params.amount1, BigInt.fromI32(token1.decimals));

  // Update pool liquidity
  let liquidityToken = ERC20.bind(event.address);
  let totalSupplyResult = liquidityToken.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    pool.totalSupply = convertTokenToDecimal(totalSupplyResult.value, BigInt.fromI32(18));
  }

  pool.reserve0 = pool.reserve0.minus(amount0);
  pool.reserve1 = pool.reserve1.minus(amount1);
  pool.save();

  // Update token liquidity
  token0.totalLiquidity = token0.totalLiquidity.minus(amount0);
  token1.totalLiquidity = token1.totalLiquidity.minus(amount1);
  token0.save();
  token1.save();

  // Create burn event
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }

  let burns = transaction.burns;
  let burn = new BurnEvent(
    event.transaction.hash.toHexString() + '-' + BigInt.fromI32(burns.length).toString(),
  );

  burn.transaction = transaction.id;
  burn.pool = pool.id;
  burn.timestamp = transaction.timestamp;
  burn.sender = event.params.sender;
  burn.to = event.params.to;
  burn.amount0 = amount0;
  burn.amount1 = amount1;
  burn.logIndex = event.logIndex;
  burn.save();

  burns.push(burn.id);
  transaction.burns = burns;
  transaction.save();

  // Update aggregated data
  updatePoolDayData(event);
  updatePoolHourData(event);
  updateTokenDayData(token0, event);
  updateTokenDayData(token1, event);
}
