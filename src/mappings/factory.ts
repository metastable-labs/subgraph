import { BigInt } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../../generated/PoolFactory/PoolFactory';
import { Pool, Token } from '../../generated/schema';
import { Pool as PoolTemplate } from '../../generated/templates';
import { ZERO_BD, ZERO_BI } from './helpers';
import { getEthPriceInUSD, findUsdPerToken } from './pricing';
import { ERC20 } from '../../generated/PoolFactory/ERC20';

export function handlePoolCreated(event: PoolCreated): void {
  let token0 = Token.load(event.params.token0.toHexString());
  let token1 = Token.load(event.params.token1.toHexString());

  if (token0 === null) {
    let erc20 = ERC20.bind(event.params.token0);
    token0 = new Token(event.params.token0.toHexString());
    token0.symbol = erc20.symbol();
    token0.name = erc20.name();
    token0.decimals = erc20.decimals();
    token0.totalSupply = ZERO_BI;
    token0.txCount = ZERO_BI;
    token0.totalLiquidity = ZERO_BD;
    token0.derivedETH = ZERO_BD;
    token0.save();
  }

  if (token1 === null) {
    let erc20 = ERC20.bind(event.params.token1);
    token1 = new Token(event.params.token1.toHexString());
    token1.symbol = erc20.symbol();
    token1.name = erc20.name();
    token1.decimals = erc20.decimals();
    token1.totalSupply = ZERO_BI;
    token1.txCount = ZERO_BI;
    token1.totalLiquidity = ZERO_BD;
    token1.derivedETH = ZERO_BD;
    token1.save();
  }

  let pool = new Pool(event.params.pool.toHexString()) as Pool;
  pool.token0 = token0.id;
  pool.token1 = token1.id;
  pool.isStable = event.params.stable;
  pool.createdAtTimestamp = event.block.timestamp;
  pool.createdAtBlockNumber = event.block.number;
  pool.txCount = ZERO_BI;
  pool.totalSupply = ZERO_BD;
  pool.token0Price = ZERO_BD;
  pool.token1Price = ZERO_BD;
  pool.volumeToken0 = ZERO_BD;
  pool.volumeToken1 = ZERO_BD;
  pool.volumeUSD = ZERO_BD;
  pool.save();

  token0.save();
  token1.save();

  // create the tracked contract based on the template
  PoolTemplate.create(event.params.pool);
}
