import { BigDecimal, BigInt, Address, log, Bytes } from '@graphprotocol/graph-ts';
import { PoolCreated, PoolFactory } from '../generated/PoolFactory/PoolFactory';
import { Swap, Mint, Burn, Pool as PoolContract } from '../generated/templates/Pool/Pool';
import { Voter } from '../generated/PoolFactory/Voter';
import { Pool, Token, PoolEvent } from '../generated/schema';
import { Gauge } from '../generated/templates/Pool/Gauge';
import { ERC20 } from '../generated/PoolFactory/ERC20';
import { Pool as PoolTemplate } from '../generated/templates';
import { calculateVolumeUSD, updatePoolTVL } from './price';

const VOTER_ADDRESS = '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5';
const SECONDS_PER_YEAR = BigInt.fromI32(31536000);

export function handlePoolCreated(event: PoolCreated): void {
  log.info('Handling PoolCreated event for pool: {}', [event.params.pool.toHexString()]);

  let pool = new Pool(event.params.pool.toHexString());
  let token0 = Token.load(event.params.token0.toHexString());
  let token1 = Token.load(event.params.token1.toHexString());

  if (token0 === null) {
    log.info('Creating new token0: {}', [event.params.token0.toHexString()]);
    token0 = new Token(event.params.token0.toHexString());
    let erc20 = ERC20.bind(event.params.token0);
    token0.symbol = erc20.symbol();
    token0.name = erc20.name();
    token0.decimals = erc20.decimals();
    token0.address = event.params.token0;
    token0.save();
  }

  if (token1 === null) {
    log.info('Creating new token1: {}', [event.params.token1.toHexString()]);
    token1 = new Token(event.params.token1.toHexString());
    let erc20 = ERC20.bind(event.params.token1);
    token1.symbol = erc20.symbol();
    token1.name = erc20.name();
    token1.decimals = erc20.decimals();
    token1.address = event.params.token1;
    token1.save();
  }

  pool.address = event.params.pool;
  pool.token0 = token0.id;
  pool.token1 = token1.id;
  pool.isStable = event.params.stable;
  pool.reserveToken0 = BigDecimal.fromString('0');
  pool.reserveToken1 = BigDecimal.fromString('0');
  pool.totalSupply = BigDecimal.fromString('0');
  pool.volumeUSD = BigDecimal.fromString('0');
  pool.tvlUSD = BigDecimal.fromString('0');
  pool.createdAt = event.block.timestamp;
  pool.updatedAt = event.block.timestamp;

  // Set default values for emissions
  pool.aeroEmissionsPerSecond = BigDecimal.zero();
  pool.aeroEmissionsApr = BigDecimal.zero();

  let voter = Voter.bind(Address.fromString(VOTER_ADDRESS));
  let gaugeAddressResult = voter.try_gauges(event.params.pool);

  if (gaugeAddressResult.reverted) {
    log.warning('Failed to get gauge address for pool: {}', [event.params.pool.toHexString()]);
    pool.gaugeAddress = null;
  } else {
    let gaugeAddress = gaugeAddressResult.value;
    if (gaugeAddress.equals(Address.zero())) {
      log.info('No gauge for pool: {}', [event.params.pool.toHexString()]);
      pool.gaugeAddress = null;
    } else {
      log.info('Gauge found for pool: {}, gauge: {}', [
        event.params.pool.toHexString(),
        gaugeAddress.toHexString(),
      ]);
      pool.gaugeAddress = gaugeAddress;
      updatePoolAeroEmissions(pool);
    }
  }

  log.info('Saving pool: {}', [pool.id]);
  updatePoolTVL(pool);
  pool.save();

  log.info('Creating new Pool template for: {}', [event.params.pool.toHexString()]);
  PoolTemplate.create(event.params.pool);
}

function updatePoolAeroEmissions(pool: Pool): void {
  let gauge = Gauge.bind(Address.fromBytes(pool.gaugeAddress!));
  let rewardRate = gauge.rewardRate();

  pool.aeroEmissionsPerSecond = rewardRate.toBigDecimal();

  // Calculate APR
  let aeroEmissionsPerYear = rewardRate.times(SECONDS_PER_YEAR);

  if (pool.totalSupply.gt(BigDecimal.zero())) {
    // APR = (emissions per year / total supply) * 100
    pool.aeroEmissionsApr = aeroEmissionsPerYear
      .toBigDecimal()
      .div(pool.totalSupply)
      .times(BigDecimal.fromString('100'));
  } else {
    pool.aeroEmissionsApr = BigDecimal.zero();
  }
}
export function handleMint(event: Mint): void {
  let poolAddress = event.address.toHexString();
  let pool = Pool.load(poolAddress);

  if (pool === null) {
    log.warning('Pool not found for mint event. Pool address: {}', [poolAddress]);
    return;
  }

  // Update pool stats
  pool.reserveToken0 = pool.reserveToken0.plus(event.params.amount0.toBigDecimal());
  pool.reserveToken1 = pool.reserveToken1.plus(event.params.amount1.toBigDecimal());

  let poolContract = PoolContract.bind(event.address);
  let totalSupplyResult = poolContract.try_totalSupply();

  if (totalSupplyResult.reverted) {
    log.warning('Failed to get total supply for pool: {}', [poolAddress]);
  } else {
    pool.totalSupply = totalSupplyResult.value.toBigDecimal();
  }

  // Update TVL and token prices
  updatePoolTVL(pool);

  pool.updatedAt = event.block.timestamp;

  updatePoolGauge(pool);
  // Only update emissions if gauge address is not null
  if (pool.gaugeAddress !== null) {
    updatePoolAeroEmissions(pool);
  } else {
    log.info('No gauge for pool: {}. Skipping emissions update.', [poolAddress]);
  }
  pool.save();

  // Create deposit event
  let depositEvent = new PoolEvent(
    event.transaction.hash.toHexString() + '-' + event.logIndex.toString(),
  );
  depositEvent.pool = pool.id;
  depositEvent.eventType = 'Deposit';
  depositEvent.amount0 = event.params.amount0.toBigDecimal();
  depositEvent.amount1 = event.params.amount1.toBigDecimal();
  depositEvent.timestamp = event.block.timestamp;
  depositEvent.save();
}

export function handleSwap(event: Swap): void {
  let poolAddress = event.address.toHexString();
  let pool = Pool.load(poolAddress);

  if (pool === null) {
    log.warning('Pool not found for swap event. Pool address: {}', [poolAddress]);
    return;
  }

  let amount0In = event.params.amount0In;
  let amount1In = event.params.amount1In;
  let amount0Out = event.params.amount0Out;
  let amount1Out = event.params.amount1Out;

  // Update reserves
  pool.reserveToken0 = pool.reserveToken0
    .plus(amount0In.toBigDecimal())
    .minus(amount0Out.toBigDecimal());
  pool.reserveToken1 = pool.reserveToken1
    .plus(amount1In.toBigDecimal())
    .minus(amount1Out.toBigDecimal());

  // Update TVL and token prices
  updatePoolTVL(pool);

  // Calculate and update volume
  let volumeUSD = calculateVolumeUSD(
    pool,
    amount0In.plus(amount0Out).toBigDecimal(),
    amount1In.plus(amount1Out).toBigDecimal(),
  );
  pool.volumeUSD = pool.volumeUSD.plus(volumeUSD);

  pool.updatedAt = event.block.timestamp;

  updatePoolGauge(pool);
  // Only update emissions if gauge address is not null
  if (pool.gaugeAddress !== null) {
    updatePoolAeroEmissions(pool);
  } else {
    log.info('No gauge for pool: {}. Skipping emissions update.', [poolAddress]);
  }
  pool.save();

  // Create swap event
  let swapEvent = new PoolEvent(
    event.transaction.hash.toHexString() + '-' + event.logIndex.toString(),
  );
  swapEvent.pool = pool.id;
  swapEvent.eventType = 'Swap';
  swapEvent.amount0 = amount0In.plus(amount0Out).toBigDecimal();
  swapEvent.amount1 = amount1In.plus(amount1Out).toBigDecimal();
  swapEvent.timestamp = event.block.timestamp;
  swapEvent.save();
}

export function handleBurn(event: Burn): void {
  let poolAddress = event.address.toHexString();
  let pool = Pool.load(poolAddress);

  if (pool === null) {
    log.warning('Pool not found for burn event. Pool address: {}', [poolAddress]);
    return;
  }

  // Update pool stats
  let amount0 = event.params.amount0;
  let amount1 = event.params.amount1;

  if (
    pool.reserveToken0.ge(amount0.toBigDecimal()) &&
    pool.reserveToken1.ge(amount1.toBigDecimal())
  ) {
    pool.reserveToken0 = pool.reserveToken0.minus(amount0.toBigDecimal());
    pool.reserveToken1 = pool.reserveToken1.minus(amount1.toBigDecimal());
  } else {
    log.warning('Burn amount exceeds pool reserves. Pool: {}, Amount0: {}, Amount1: {}', [
      poolAddress,
      amount0.toString(),
      amount1.toString(),
    ]);
  }

  let poolContract = PoolContract.bind(event.address);
  let totalSupplyResult = poolContract.try_totalSupply();

  if (totalSupplyResult.reverted) {
    log.warning('Failed to get total supply for pool: {}', [poolAddress]);
  } else {
    pool.totalSupply = totalSupplyResult.value.toBigDecimal();
  }

  // Update TVL and token prices
  updatePoolTVL(pool);

  pool.updatedAt = event.block.timestamp;

  updatePoolGauge(pool);
  // Only update emissions if gauge address is not null
  if (pool.gaugeAddress !== null) {
    updatePoolAeroEmissions(pool);
  } else {
    log.info('No gauge for pool: {}. Skipping emissions update.', [poolAddress]);
  }
  pool.save();

  // Create withdraw event
  let withdrawEvent = new PoolEvent(
    event.transaction.hash.toHexString() + '-' + event.logIndex.toString(),
  );
  withdrawEvent.pool = pool.id;
  withdrawEvent.eventType = 'Withdraw';
  withdrawEvent.amount0 = amount0.toBigDecimal();
  withdrawEvent.amount1 = amount1.toBigDecimal();
  withdrawEvent.timestamp = event.block.timestamp;
  withdrawEvent.save();
}

function updatePoolGauge(pool: Pool): void {
  let voter = Voter.bind(Address.fromString(VOTER_ADDRESS));
  let gaugeAddress = voter.try_gauges(Address.fromString(pool.id));

  if (gaugeAddress.reverted) {
    log.warning('Failed to get gauge address for pool: {}', [pool.id]);
    pool.gaugeAddress = null;
  } else if (gaugeAddress.value.equals(Address.zero())) {
    pool.gaugeAddress = null;
  } else {
    pool.gaugeAddress = gaugeAddress.value;
  }
}
