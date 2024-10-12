import { BigInt, Address, log } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../generated/PoolFactory/PoolFactory';
import { Voter } from '../generated/PoolFactory/Voter';
import { Pool, Token } from '../generated/schema';
import { ERC20 } from '../generated/PoolFactory/ERC20';
import { Pool as PoolTemplate } from '../generated/templates';
import { updatePoolAeroEmissions } from './pool';

const VOTER_ADDRESS = '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5';

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
  pool.reserve0 = BigInt.fromI32(0);
  pool.reserve1 = BigInt.fromI32(0);
  pool.totalSupply = BigInt.fromI32(0);
  pool.createdAt = event.block.timestamp;
  pool.updatedAt = event.block.timestamp;

  // Set default values for emissions
  pool.aeroEmissionsPerSecond = BigInt.fromI32(0);
  pool.aeroEmissionsApr = BigInt.fromI32(0);

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
  pool.save();

  log.info('Creating new Pool template for: {}', [event.params.pool.toHexString()]);
  PoolTemplate.create(event.params.pool);
}
