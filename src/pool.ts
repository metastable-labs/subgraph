import { BigInt, Address, log } from '@graphprotocol/graph-ts';
import { Swap, Mint, Burn, Pool as PoolContract } from '../generated/templates/Pool/Pool';
import { Voter } from '../generated/PoolFactory/Voter';
import { Pool, PoolEvent } from '../generated/schema';
import { Gauge } from '../generated/templates/Pool/Gauge';

const VOTER_ADDRESS = '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5';
const SECONDS_PER_YEAR = BigInt.fromI32(31536000);

export function updatePoolAeroEmissions(pool: Pool): void {
  let gauge = Gauge.bind(Address.fromBytes(pool.gaugeAddress!));
  let rewardRate = gauge.rewardRate();

  pool.aeroEmissionsPerSecond = rewardRate;

  // Calculate APR
  let aeroEmissionsPerYear = rewardRate.times(SECONDS_PER_YEAR);

  if (pool.totalSupply.gt(BigInt.fromI32(0))) {
    // APR = (emissions per year / total supply) * 100
    pool.aeroEmissionsApr = aeroEmissionsPerYear.times(BigInt.fromI32(100)).div(pool.totalSupply);
  } else {
    pool.aeroEmissionsApr = BigInt.fromI32(0);
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
  pool.reserve0 = pool.reserve0.plus(event.params.amount0);
  pool.reserve1 = pool.reserve1.plus(event.params.amount1);

  let poolContract = PoolContract.bind(event.address);
  let totalSupplyResult = poolContract.try_totalSupply();

  if (totalSupplyResult.reverted) {
    log.warning('Failed to get total supply for pool: {}', [poolAddress]);
  } else {
    pool.totalSupply = totalSupplyResult.value;
  }

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
  depositEvent.amount0 = event.params.amount0;
  depositEvent.amount1 = event.params.amount1;
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
  pool.reserve0 = pool.reserve0.plus(amount0In).minus(amount0Out);
  pool.reserve1 = pool.reserve1.plus(amount1In).minus(amount1Out);

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
  swapEvent.amount0 = amount0In.plus(amount0Out);
  swapEvent.amount1 = amount1In.plus(amount1Out);
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

  if (pool.reserve0.ge(amount0) && pool.reserve1.ge(amount1)) {
    pool.reserve0 = pool.reserve0.minus(amount0);
    pool.reserve1 = pool.reserve1.minus(amount1);
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
    pool.totalSupply = totalSupplyResult.value;
  }

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
  withdrawEvent.amount0 = amount0;
  withdrawEvent.amount1 = amount1;
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
