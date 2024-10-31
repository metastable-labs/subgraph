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
  let dayID = timestamp / 86400; // 86400 seconds in a day
  let dayStartTimestamp = dayID * 86400;

  let dayData = AerodromeDayData.load(dayID.toString());
  if (dayData === null) {
    dayData = new AerodromeDayData(dayID.toString());
    dayData.date = dayStartTimestamp;
    dayData.dailyVolumeToken0 = ZERO_BD;
    dayData.dailyVolumeToken1 = ZERO_BD;
    dayData.txCount = ZERO_BI;
  }

  if (aerodrome) {
    dayData.txCount = aerodrome.txCount;
  }
  dayData.save();

  return dayData;
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
    poolDayData.dailyVolumeToken0 = ZERO_BD;
    poolDayData.dailyVolumeToken1 = ZERO_BD;
    poolDayData.dailyTxns = ZERO_BI;
  }

  if (pool) {
    // Update reserves and supply
    poolDayData.reserve0 = pool.reserve0;
    poolDayData.reserve1 = pool.reserve1;
    poolDayData.totalSupply = pool.totalSupply;
  }

  // Increment transaction count
  poolDayData.dailyTxns = poolDayData.dailyTxns.plus(ONE_BI);
  poolDayData.save();

  return poolDayData;
}

export function updatePoolHourData(event: ethereum.Event): PoolHourData {
  let timestamp = event.block.timestamp.toI32();
  let hourIndex = timestamp / 3600; // 3600 seconds in an hour
  let hourStartUnix = hourIndex * 3600;
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
    poolHourData.hourlyVolumeToken0 = ZERO_BD;
    poolHourData.hourlyVolumeToken1 = ZERO_BD;
    poolHourData.hourlyTxns = ZERO_BI;
  }

  if (pool) {
    // Update reserves and supply
    poolHourData.reserve0 = pool.reserve0;
    poolHourData.reserve1 = pool.reserve1;
    poolHourData.totalSupply = pool.totalSupply;
  }

  // Increment transaction count
  poolHourData.hourlyTxns = poolHourData.hourlyTxns.plus(ONE_BI);
  poolHourData.save();

  return poolHourData;
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
    tokenDayData.dailyVolumeToken = ZERO_BD;
    tokenDayData.dailyTxns = ZERO_BI;
    tokenDayData.totalLiquidity = ZERO_BD;
  }

  // Update liquidity and transaction count
  tokenDayData.totalLiquidity = token.totalLiquidity;
  tokenDayData.dailyTxns = tokenDayData.dailyTxns.plus(ONE_BI);
  tokenDayData.save();

  return tokenDayData;
}
