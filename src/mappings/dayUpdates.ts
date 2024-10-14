import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import {
  AerodromeDayData,
  AerodromeFactory,
  Pool,
  PoolDayData,
  PoolHourData,
  Token,
  TokenDayData,
} from '../../generated/schema';
import { FACTORY_ADDRESS, ZERO_BD, ZERO_BI, ONE_BI } from './helpers';

export function updateAerodromeDayData(event: ethereum.Event): AerodromeDayData {
  let aerodrome = AerodromeFactory.load(FACTORY_ADDRESS);
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let aerodromeDayData = AerodromeDayData.load(dayID.toString());
  if (aerodromeDayData === null) {
    aerodromeDayData = new AerodromeDayData(dayID.toString());
    aerodromeDayData.date = dayStartTimestamp;
    aerodromeDayData.dailyVolumeUSD = ZERO_BD;
    aerodromeDayData.dailyVolumeETH = ZERO_BD;
    aerodromeDayData.totalVolumeUSD = ZERO_BD;
    aerodromeDayData.totalVolumeETH = ZERO_BD;
  }

  if (aerodrome) {
    aerodromeDayData.totalLiquidityUSD = aerodrome.totalLiquidityUSD;
    aerodromeDayData.totalLiquidityETH = aerodrome.totalLiquidityUSD; // Changed from totalLiquidityETH to totalLiquidityUSD
    aerodromeDayData.txCount = aerodrome.txCount;
  }
  aerodromeDayData.save();

  return aerodromeDayData as AerodromeDayData;
}

export function updatePoolDayData(event: ethereum.Event): PoolDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let dayPoolID = event.address.toHexString().concat('-').concat(dayID.toString());
  let pool = Pool.load(event.address.toHexString());
  let poolDayData = PoolDayData.load(dayPoolID);
  if (poolDayData === null) {
    poolDayData = new PoolDayData(dayPoolID);
    poolDayData.date = dayStartTimestamp;
    poolDayData.poolAddress = event.address;
    poolDayData.token0 = pool ? pool.token0 : '';
    poolDayData.token1 = pool ? pool.token1 : '';
    poolDayData.reserve0 = ZERO_BD;
    poolDayData.reserve1 = ZERO_BD;
    poolDayData.totalSupply = ZERO_BD;
    poolDayData.reserveUSD = ZERO_BD;
    poolDayData.dailyVolumeToken0 = ZERO_BD;
    poolDayData.dailyVolumeToken1 = ZERO_BD;
    poolDayData.dailyVolumeUSD = ZERO_BD;
    poolDayData.dailyTxns = ZERO_BI;
  }

  if (pool) {
    poolDayData.reserve0 = pool.reserve0;
    poolDayData.reserve1 = pool.reserve1;
    poolDayData.totalSupply = pool.totalSupply;
    poolDayData.reserveUSD = pool.reserveUSD;
  }
  poolDayData.dailyTxns = poolDayData.dailyTxns.plus(ONE_BI);
  poolDayData.save();

  return poolDayData as PoolDayData;
}

export function updatePoolHourData(event: ethereum.Event): PoolHourData {
  let timestamp = event.block.timestamp.toI32();
  let hourIndex = timestamp / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let hourPoolID = event.address.toHexString().concat('-').concat(hourIndex.toString());
  let pool = Pool.load(event.address.toHexString());
  let poolHourData = PoolHourData.load(hourPoolID);
  if (poolHourData === null) {
    poolHourData = new PoolHourData(hourPoolID);
    poolHourData.hourStartUnix = hourStartUnix;
    poolHourData.pool = event.address.toHexString();
    poolHourData.reserve0 = ZERO_BD;
    poolHourData.reserve1 = ZERO_BD;
    poolHourData.totalSupply = ZERO_BD;
    poolHourData.reserveUSD = ZERO_BD;
    poolHourData.hourlyVolumeToken0 = ZERO_BD;
    poolHourData.hourlyVolumeToken1 = ZERO_BD;
    poolHourData.hourlyVolumeUSD = ZERO_BD;
    poolHourData.hourlyTxns = ZERO_BI;
  }

  if (pool) {
    poolHourData.reserve0 = pool.reserve0;
    poolHourData.reserve1 = pool.reserve1;
    poolHourData.totalSupply = pool.totalSupply;
    poolHourData.reserveUSD = pool.reserveUSD;
  }
  poolHourData.hourlyTxns = poolHourData.hourlyTxns.plus(ONE_BI);
  poolHourData.save();

  return poolHourData as PoolHourData;
}

export function updateTokenDayData(token: Token, event: ethereum.Event): TokenDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let tokenDayID = token.id.toString().concat('-').concat(dayID.toString());

  let tokenDayData = TokenDayData.load(tokenDayID);
  if (tokenDayData === null) {
    tokenDayData = new TokenDayData(tokenDayID);
    tokenDayData.date = dayStartTimestamp;
    tokenDayData.token = token.id;
    tokenDayData.priceUSD = token.derivedETH.times(token.derivedETH);
    tokenDayData.dailyVolumeToken = ZERO_BD;
    tokenDayData.dailyVolumeETH = ZERO_BD;
    tokenDayData.dailyVolumeUSD = ZERO_BD;
    tokenDayData.dailyTxns = ZERO_BI;
    tokenDayData.totalLiquidityUSD = ZERO_BD;
  }
  tokenDayData.priceUSD = token.derivedETH.times(token.derivedETH);
  tokenDayData.totalLiquidityToken = token.totalLiquidity;
  tokenDayData.totalLiquidityETH = token.totalLiquidity.times(token.derivedETH);
  tokenDayData.totalLiquidityUSD = tokenDayData.totalLiquidityETH.times(token.derivedETH);
  tokenDayData.dailyTxns = tokenDayData.dailyTxns.plus(ONE_BI);
  tokenDayData.save();

  return tokenDayData as TokenDayData;
}
