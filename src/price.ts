import { BigDecimal, Address } from '@graphprotocol/graph-ts';
import { Pool, Token } from '../generated/schema';

const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const USDC_ADDRESS = '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6cA';
const MINIMUM_LIQUIDITY_THRESHOLD_USD = BigDecimal.fromString('1000');

function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return BigDecimal.fromString('1');
  }

  let ethPool =
    Pool.load(token.id + '-' + WETH_ADDRESS) || Pool.load(WETH_ADDRESS + '-' + token.id);
  if (ethPool !== null) {
    return calculateEthPrice(ethPool, token);
  }

  return BigDecimal.zero();
}

function calculateEthPrice(ethPool: Pool, token: Token): BigDecimal {
  let tokenReserve = ethPool.token0 == token.id ? ethPool.reserveToken0 : ethPool.reserveToken1;
  let ethReserve = ethPool.token0 == token.id ? ethPool.reserveToken1 : ethPool.reserveToken0;

  if (tokenReserve.gt(BigDecimal.zero())) {
    return ethReserve.div(tokenReserve);
  }

  return BigDecimal.zero();
}

function getEthPriceInUSD(): BigDecimal {
  let usdcPool =
    Pool.load(WETH_ADDRESS + '-' + USDC_ADDRESS) || Pool.load(USDC_ADDRESS + '-' + WETH_ADDRESS);
  if (usdcPool !== null) {
    let ethReserve =
      usdcPool.token0 == WETH_ADDRESS ? usdcPool.reserveToken0 : usdcPool.reserveToken1;
    let usdcReserve =
      usdcPool.token0 == USDC_ADDRESS ? usdcPool.reserveToken0 : usdcPool.reserveToken1;

    if (ethReserve.gt(BigDecimal.zero())) {
      let ethPrice = usdcReserve.div(ethReserve);
      return ethPrice.times(BigDecimal.fromString('1000000')); // Adjust for USDC decimals
    }
  }

  return BigDecimal.fromString('1800'); // Fallback price if no valid pool found
}

export function getTokenPrice(token: Token): BigDecimal {
  let ethPerToken = findEthPerToken(token);
  let usdPerEth = getEthPriceInUSD();

  return ethPerToken.times(usdPerEth);
}

export function updatePoolTVL(pool: Pool): void {
  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 === null || token1 === null) return;

  let price0 = getTokenPrice(token0);
  let price1 = getTokenPrice(token1);

  token0.priceUSD = price0;
  token1.priceUSD = price1;

  let tvl = pool.reserveToken0.times(price0).plus(pool.reserveToken1.times(price1));

  pool.tvlUSD = tvl;

  token0.save();
  token1.save();
}

export function calculateVolumeUSD(
  pool: Pool,
  amount0: BigDecimal,
  amount1: BigDecimal,
): BigDecimal {
  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 === null || token1 === null) return BigDecimal.zero();

  let price0 = token0.priceUSD!;
  let price1 = token1.priceUSD!;

  return amount0.times(price0).plus(amount1.times(price1));
}
