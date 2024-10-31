import { BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../../generated/PoolFactory/PoolFactory';
import { Pool, Token, AerodromeFactory } from '../../generated/schema';
import { Pool as PoolTemplate } from '../../generated/templates';
import { ERC20 } from '../../generated/PoolFactory/ERC20';
import { FACTORY_ADDRESS } from './constants';

const ZERO_BD = BigDecimal.fromString('0');
const ZERO_BI = BigInt.fromI32(0);

function formatTokenAmount(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return amount.toBigDecimal().div(scale);
}

export function handlePoolCreated(event: PoolCreated): void {
  // Load or create factory
  let factory = AerodromeFactory.load(FACTORY_ADDRESS);
  if (factory === null) {
    factory = new AerodromeFactory(FACTORY_ADDRESS);
    factory.poolCount = 0;
    factory.txCount = ZERO_BI;
  }
  factory.poolCount = factory.poolCount + 1;
  factory.save();

  // Load or create tokens
  let token0 = Token.load(event.params.token0.toHexString());
  let token1 = Token.load(event.params.token1.toHexString());

  if (token0 === null) {
    let token0Contract = ERC20.bind(event.params.token0);
    let decimals = token0Contract.decimals();

    token0 = new Token(event.params.token0.toHexString());
    token0.symbol = token0Contract.symbol();
    token0.name = token0Contract.name();
    token0.decimals = decimals;

    // Format total supply using decimals
    let totalSupply = token0Contract.totalSupply();
    token0.totalSupply = totalSupply;
    token0.tradeVolume = ZERO_BD;
    token0.txCount = ZERO_BI;
    token0.totalLiquidity = ZERO_BD;
    token0.save();
  }

  if (token1 === null) {
    let token1Contract = ERC20.bind(event.params.token1);
    let decimals = token1Contract.decimals();

    token1 = new Token(event.params.token1.toHexString());
    token1.symbol = token1Contract.symbol();
    token1.name = token1Contract.name();
    token1.decimals = decimals;

    // Format total supply using decimals
    let totalSupply = token1Contract.totalSupply();
    token1.totalSupply = totalSupply;
    token1.tradeVolume = ZERO_BD;
    token1.txCount = ZERO_BI;
    token1.totalLiquidity = ZERO_BD;
    token1.save();
  }

  // Create new pool
  let pool = new Pool(event.params.pool.toHexString());
  pool.token0 = token0.id;
  pool.token1 = token1.id;
  pool.isStable = event.params.stable;
  pool.createdAtTimestamp = event.block.timestamp;
  pool.createdAtBlockNumber = event.block.number;
  pool.txCount = ZERO_BI;
  pool.totalSupply = ZERO_BD;
  pool.volumeToken0 = ZERO_BD;
  pool.volumeToken1 = ZERO_BD;
  pool.reserve0 = ZERO_BD;
  pool.reserve1 = ZERO_BD;
  pool.save();

  // Create the tracked contract based on the template
  PoolTemplate.create(event.params.pool);
}
