import { BigDecimal, Address, BigInt } from '@graphprotocol/graph-ts';
import { OffchainOracle } from '../../generated/PoolFactory/OffchainOracle';
import { ERC20 } from '../../generated/PoolFactory/ERC20';
import { exponentToBigDecimal, ZERO_BD } from './helpers';

export const OFFCHAIN_ORACLE = '0xf224a25453D76A41c4427DD1C05369BC9f498444';

export const BASE_CONNECTOR: string[] = [
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
  '0x940181a94A35A4569E4529A3CDfB74e38FD98631', // AERO
  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', // DAI
  '0x4621b7A9c75199271F773Ebd9A499dbd165c3191', // DOLA
  '0x4200000000000000000000000000000000000006', // WETH
  '0xB79DD08EA68A908A97220C76d19A6aA9cBDE4376', // USD+
  '0xf7A0dd3317535eC4f4d29ADF9d620B3d8D5D5069', // stERN
  '0xCfA3Ef56d303AE4fAabA0592388F19d7C3399FB4', // eUSD
  '0xCb327b99fF831bF8223cCEd12B1338FF3aA322Ff', // bsdETH
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22', // cbETH
  '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452', // wstETH
  '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', // EURC
  '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC
];

export function getEthPriceInUSD(): BigDecimal {
  let offchainOracle = OffchainOracle.bind(Address.fromString(OFFCHAIN_ORACLE));
  let ethPrice = offchainOracle.try_getRateToEth(
    Address.fromString('0x4200000000000000000000000000000000000006'), // WETH
    true,
  );

  if (ethPrice.reverted) {
    return ZERO_BD;
  }

  return ethPrice.value.toBigDecimal().div(exponentToBigDecimal(BigInt.fromI32(18)));
}

export function findUsdPerToken(tokenAddress: string): BigDecimal {
  let offchainOracle = OffchainOracle.bind(Address.fromString(OFFCHAIN_ORACLE));
  let customConnectors: Address[] = [];

  for (let i = 0; i < BASE_CONNECTOR.length; i++) {
    customConnectors.push(Address.fromString(BASE_CONNECTOR[i]));
  }

  let tokenPrice = offchainOracle.try_getRateToEthWithCustomConnectors(
    Address.fromString(tokenAddress),
    true,
    customConnectors,
    BigInt.fromI32(1000000000000000000), // 1e18
  );

  if (tokenPrice.reverted) {
    return ZERO_BD;
  }

  let ethPrice = getEthPriceInUSD();
  let tokenDecimals = fetchTokenDecimals(Address.fromString(tokenAddress));

  return tokenPrice.value
    .toBigDecimal()
    .div(exponentToBigDecimal(BigInt.fromI32(18)))
    .times(ethPrice)
    .div(exponentToBigDecimal(tokenDecimals));
}

function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  let decimals = null;
  let decimalsResult = contract.try_decimals();
  if (!decimalsResult.reverted) {
    decimals = decimalsResult.value;
  }
  return BigInt.fromI32(decimals ? decimals : 18);
}
