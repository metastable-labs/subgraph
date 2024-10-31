import { BigInt } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../../generated/PoolFactory/PoolFactory';
import { Pool, Token } from '../../generated/schema';
import { Pool as PoolTemplate } from '../../generated/templates';
import { ZERO_BD, ZERO_BI } from './helpers';
import { ERC20 } from '../../generated/PoolFactory/ERC20';
import { AerodromeFactory } from '../../generated/schema';

export function handlePoolCreated(event: PoolCreated): void {
  // Load or create factory
  let factory = AerodromeFactory.load(event.address.toHexString());
  if (factory === null) {
    factory = new AerodromeFactory(event.address.toHexString());
    factory.poolCount = 0;
    factory.txCount = ZERO_BI;
  }
  factory.poolCount = factory.poolCount + 1;
  factory.save();

  // Load or create tokens
  let token0 = Token.load(event.params.token0.toHexString());
  let token1 = Token.load(event.params.token1.toHexString());

  if (token0 === null) {
    let erc20 = ERC20.bind(event.params.token0);
    token0 = new Token(event.params.token0.toHexString());
    token0.symbol = erc20.symbol();
    token0.name = erc20.name();
    token0.decimals = erc20.decimals();
    token0.totalSupply = erc20.totalSupply();
    token0.tradeVolume = ZERO_BD;
    token0.txCount = ZERO_BI;
    token0.totalLiquidity = ZERO_BD;
    token0.save();
  }

  if (token1 === null) {
    let erc20 = ERC20.bind(event.params.token1);
    token1 = new Token(event.params.token1.toHexString());
    token1.symbol = erc20.symbol();
    token1.name = erc20.name();
    token1.decimals = erc20.decimals();
    token1.totalSupply = erc20.totalSupply();
    token1.tradeVolume = ZERO_BD;
    token1.txCount = ZERO_BI;
    token1.totalLiquidity = ZERO_BD;
    token1.save();
  }

  // Create the pool
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
