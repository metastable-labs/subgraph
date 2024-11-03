import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';
import { Token } from '../../generated/schema';
import { OffchainOracle } from '../../generated/PoolFactory/OffchainOracle';
import { ChainlinkOracle } from '../../generated/PoolFactory/ChainlinkOracle';
import { ZERO_BD } from './constants';

// Oracle addresses
const OFFCHAIN_ORACLE_ADDRESS = '0xf224a25453D76A41c4427DD1C05369BC9f498444';
const ETH_USD_ORACLE_ADDRESS = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';

export function getTokenETHPrice(tokenAddress: Address, decimals: i32): BigDecimal {
  let oracle = OffchainOracle.bind(Address.fromString(OFFCHAIN_ORACLE_ADDRESS));

  // Use the simpler getRateToEth method
  let rateResult = oracle.try_getRateToEth(
    tokenAddress,
    true, // use wrappers
  );

  if (rateResult.reverted) {
    return ZERO_BD;
  }

  // Format the rate using token decimals
  let scale = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  return rateResult.value.toBigDecimal().div(scale);
}

export function getETHUSDPrice(): BigDecimal {
  let oracle = ChainlinkOracle.bind(Address.fromString(ETH_USD_ORACLE_ADDRESS));
  let priceResult = oracle.try_latestAnswer();

  if (priceResult.reverted) {
    return ZERO_BD;
  }

  // Chainlink ETH/USD price feed uses 8 decimals
  return priceResult.value.toBigDecimal().div(BigDecimal.fromString('100000000'));
}

export function getTokenUSDPrice(tokenAddress: Address, decimals: i32): BigDecimal {
  let ethPrice = getETHUSDPrice();
  if (ethPrice.equals(ZERO_BD)) {
    return ZERO_BD;
  }

  let tokenETHPrice = getTokenETHPrice(tokenAddress, decimals);
  return tokenETHPrice.times(ethPrice);
}

export function updateTokenPrices(token: Token): void {
  let tokenAddress = Address.fromString(token.id);

  // Update ETH price
  token.ethPrice = getTokenETHPrice(tokenAddress, token.decimals);

  // Update USD price
  token.usdPrice = getTokenUSDPrice(tokenAddress, token.decimals);

  token.save();
}
