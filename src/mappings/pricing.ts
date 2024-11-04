import { BigInt, BigDecimal, Address, log } from '@graphprotocol/graph-ts';
import { OffchainOracle } from '../../generated/PoolFactory/OffchainOracle';
import { ChainlinkOracle } from '../../generated/PoolFactory/ChainlinkOracle';
import { Token } from '../../generated/schema';
import { ZERO_BD } from './constants';

const OFFCHAIN_ORACLE_ADDRESS = '0xf224a25453D76A41c4427DD1C05369BC9f498444';
const ETH_USD_ORACLE_ADDRESS = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';

export function getTokenETHPrice(tokenAddress: Address, decimals: i32): BigDecimal {
  log.info('Getting ETH price for token {}', [tokenAddress.toHexString()]);

  let oracle = OffchainOracle.bind(Address.fromString(OFFCHAIN_ORACLE_ADDRESS));

  let rateResult = oracle.try_getRateToEth(
    tokenAddress,
    true, // use wrappers
  );

  if (rateResult.reverted) {
    log.warning('Price oracle reverted for token {}', [tokenAddress.toHexString()]);
    return ZERO_BD;
  }

  // Format the rate using token decimals
  let scale = BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal();
  let price = rateResult.value.toBigDecimal().div(scale);
  log.info('ETH price for token {}: {}', [tokenAddress.toHexString(), price.toString()]);

  return price;
}

export function getETHUSDPrice(): BigDecimal {
  log.info('Getting ETH/USD price', []);

  let oracle = ChainlinkOracle.bind(Address.fromString(ETH_USD_ORACLE_ADDRESS));
  let priceResult = oracle.try_latestAnswer();

  if (priceResult.reverted) {
    log.warning('ETH/USD oracle reverted', []);
    return ZERO_BD;
  }

  let price = priceResult.value.toBigDecimal().div(BigDecimal.fromString('100000000'));
  log.info('ETH/USD price: {}', [price.toString()]);

  return price;
}

export function updateTokenPrices(token: Token): void {
  log.info('Updating prices for token {}', [token.id]);

  let tokenAddress = Address.fromString(token.id);

  // Update ETH price
  token.ethPrice = getTokenETHPrice(tokenAddress, token.decimals);

  // Update USD price
  let ethUSDPrice = getETHUSDPrice();
  token.usdPrice = token.ethPrice.times(ethUSDPrice);

  log.info('Updated prices for token {} - ETH: {}, USD: {}', [
    token.id,
    token.ethPrice.toString(),
    token.usdPrice.toString(),
  ]);

  token.save();
}
