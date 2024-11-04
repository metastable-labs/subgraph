import { BigInt, BigDecimal, Address, log } from '@graphprotocol/graph-ts';
import { PoolCreated, PoolFactory } from '../../generated/PoolFactory/PoolFactory';
import { Pool, Token, AerodromeFactory } from '../../generated/schema';
import { Pool as PoolTemplate } from '../../generated/templates';
import { ERC20 } from '../../generated/PoolFactory/ERC20';
import { ADDRESS_ZERO, FACTORY_ADDRESS } from './constants';
import { updateTokenPrices } from './pricing';
import { formatFeePercent } from './utils';

const ZERO_BD = BigDecimal.fromString('0');
const ZERO_BI = BigInt.fromI32(0);

function formatTokenAmount(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return amount.toBigDecimal().div(scale);
}

export function handlePoolCreated(event: PoolCreated): void {
  log.info('Creating new pool {} with tokens {}/{}', [
    event.params.pool.toHexString(),
    event.params.token0.toHexString(),
    event.params.token1.toHexString(),
  ]);

  let factory = AerodromeFactory.load(FACTORY_ADDRESS);
  if (factory === null) {
    factory = new AerodromeFactory(FACTORY_ADDRESS);
    factory.poolCount = 0;
    factory.txCount = ZERO_BI;
    log.info('Created new factory', []);
  }

  factory.poolCount = factory.poolCount + 1;
  factory.save();

  let token0 = Token.load(event.params.token0.toHexString());
  let token1 = Token.load(event.params.token1.toHexString());

  if (token0 === null) {
    let erc20 = ERC20.bind(event.params.token0);
    token0 = new Token(event.params.token0.toHexString());
    token0.symbol = erc20.symbol();
    token0.name = erc20.name();
    token0.decimals = erc20.decimals();
    token0.totalSupply = ZERO_BI;
    token0.tradeVolume = ZERO_BD;
    token0.txCount = ZERO_BI;
    token0.totalLiquidity = ZERO_BD;
    token0.ethPrice = ZERO_BD;
    token0.usdPrice = ZERO_BD;

    // Get initial prices
    updateTokenPrices(token0);
    token0.save();
    log.info('Created token0 {} with price {}', [token0.symbol, token0.usdPrice.toString()]);
  }

  if (token1 === null) {
    let erc20 = ERC20.bind(event.params.token1);
    token1 = new Token(event.params.token1.toHexString());
    token1.symbol = erc20.symbol();
    token1.name = erc20.name();
    token1.decimals = erc20.decimals();
    token1.totalSupply = ZERO_BI;
    token1.tradeVolume = ZERO_BD;
    token1.txCount = ZERO_BI;
    token1.totalLiquidity = ZERO_BD;
    token1.ethPrice = ZERO_BD;
    token1.usdPrice = ZERO_BD;

    // Get initial prices
    updateTokenPrices(token1);
    token1.save();
    log.info('Created token1 {} with price {}', [token1.symbol, token1.usdPrice.toString()]);
  }

  let pool = new Pool(event.params.pool.toHexString());
  pool.token0 = token0.id;
  pool.token1 = token1.id;
  pool.isStable = event.params.stable;
  pool.createdAtTimestamp = event.block.timestamp;
  pool.createdAtBlockNumber = event.block.number;
  pool.txCount = ZERO_BI;
  pool.totalSupply = ZERO_BD;
  pool.volumeToken0 = ZERO_BD;
  pool.volumeToken0USD = ZERO_BD;
  pool.volumeToken1USD = ZERO_BD;
  pool.volumeToken1 = ZERO_BD;
  pool.volumeUSD = ZERO_BD;
  pool.reserve0 = ZERO_BD;
  pool.reserve1 = ZERO_BD;
  pool.reserve0USD = ZERO_BD;
  pool.reserve1USD = ZERO_BD;
  pool.tvlUSD = ZERO_BD;
  pool.emissionsPerSecond = ZERO_BD;
  pool.yearlyEmissions = ZERO_BD;
  pool.emissionsToken = Address.fromString('0x940181a94A35A4569e4529A3CDfB74e38FD98631'); // AERO token

  pool.claimableToken0 = ZERO_BD;
  pool.claimableToken1 = ZERO_BD;
  pool.totalFeesUSD = ZERO_BD;

  // Get fee from factory
  let feeResult = PoolFactory.bind(Address.fromString(FACTORY_ADDRESS)).try_getFee(
    event.params.pool,
    event.params.stable,
  );

  if (!feeResult.reverted) {
    pool.feePercent = formatFeePercent(feeResult.value);
    log.info('Set fee for pool: {}', [pool.feePercent.toString()]);
  } else {
    pool.feePercent = ZERO_BD;
    log.warning('Fee fetch reverted for pool {}', [event.params.pool.toHexString()]);
  }

  pool.save();
  log.info('Created pool {} with tokens {}/{}', [pool.id, token0.symbol, token1.symbol]);

  // Create the tracked contract based on the template
  PoolTemplate.create(event.params.pool);
}
