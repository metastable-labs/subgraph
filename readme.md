# Aerodrome Subgraph Documentation

## Overview

This subgraph indexes and tracks data from the Aerodrome protocol on the Base network. It provides real-time insights into pools, tokens, transactions, and various protocol metrics, enabling developers to build powerful analytics tools and applications.

## Entities

The subgraph schema defines several entities to represent different aspects of the Aerodrome protocol:

### Pool

Represents a liquidity pool in the Aerodrome protocol.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | The pool's contract address |
| token0 | Token | The first token in the pool |
| token1 | Token | The second token in the pool |
| totalSupply | BigDecimal | The total supply of liquidity tokens |
| reserve0 | BigDecimal | The reserve of token0 |
| reserve1 | BigDecimal | The reserve of token1 |
| reserveUSD | BigDecimal | The total reserve value in USD |
| token0Price | BigDecimal | The price of token0 in terms of token1 |
| token1Price | BigDecimal | The price of token1 in terms of token0 |
| volumeToken0 | BigDecimal | The total volume of token0 |
| volumeToken1 | BigDecimal | The total volume of token1 |
| volumeUSD | BigDecimal | The total volume in USD |
| txCount | BigInt | The total number of transactions |
| createdAtTimestamp | BigInt | The timestamp when the pool was created |

### Token

Represents a token traded on Aerodrome.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | The token's contract address |
| symbol | String | The token's symbol |
| name | String | The token's name |
| decimals | BigInt | The number of decimal places |
| totalSupply | BigInt | The total supply of the token |
| tradeVolume | BigDecimal | The total trade volume of the token |
| tradeVolumeUSD | BigDecimal | The total trade volume in USD |
| txCount | BigInt | The total number of transactions involving this token |
| totalLiquidity | BigDecimal | The total liquidity of the token across all pools |

### Swap

Represents a swap transaction.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier for the swap |
| transaction | Transaction | The transaction entity |
| timestamp | BigInt | The timestamp of the swap |
| pool | Pool | The pool in which the swap occurred |
| token0 | Token | The first token in the swap |
| token1 | Token | The second token in the swap |
| sender | Bytes | The address that initiated the swap |
| recipient | Bytes | The address that received the output tokens |
| amount0In | BigDecimal | The amount of token0 swapped in |
| amount1In | BigDecimal | The amount of token1 swapped in |
| amount0Out | BigDecimal | The amount of token0 swapped out |
| amount1Out | BigDecimal | The amount of token1 swapped out |
| amountUSD | BigDecimal | The total value of the swap in USD |

### Transaction

Represents a transaction on the Aerodrome protocol.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | The transaction hash |
| blockNumber | BigInt | The block number of the transaction |
| timestamp | BigInt | The timestamp of the transaction |
| mints | [Mint!]! | List of mint events in this transaction |
| burns | [Burn!]! | List of burn events in this transaction |
| swaps | [Swap!]! | List of swap events in this transaction |

## Key Functions

### Pricing

The subgraph uses a sophisticated pricing mechanism to calculate token prices in USD:

- `getEthPriceInUSD()`: Calculates the price of ETH in USD using a weighted average of WETH-USDC, WETH-DAI, and WETH-DOLA pairs.
- `findEthPerToken()`: Derives the ETH price for a given token by searching through whitelisted token pairs.
- `getTrackedVolumeUSD()`: Calculates the USD volume for a swap, taking into account the whitelist status of the tokens involved.
- `getTrackedLiquidityUSD()`: Calculates the USD value of liquidity, considering the whitelist status of the tokens.

### Event Handling

The subgraph handles various events emitted by the Aerodrome protocol:

- `handleSwap()`: Processes swap events, updating volume metrics and token prices.
- `handleMint()`: Handles liquidity provision events, updating reserves and liquidity metrics.
- `handleBurn()`: Processes liquidity removal events, updating reserves and liquidity metrics.

## Querying the Subgraph

You can query this subgraph using GraphQL. Here are some example queries:

### Get Top Pools by Total Value Locked (TVL)

```graphql
{
  pools(first: 10, orderBy: reserveUSD, orderDirection: desc) {
    id
    token0 {
      symbol
    }
    token1 {
      symbol
    }
    reserveUSD
    volumeUSD
  }
}
```

### Get Recent Swaps

```graphql
{
  swaps(first: 20, orderBy: timestamp, orderDirection: desc) {
    transaction {
      id
    }
    timestamp
    pool {
      token0 {
        symbol
      }
      token1 {
        symbol
      }
    }
    amount0In
    amount1Out
    amountUSD
  }
}
```

### Get Token Information

```graphql
{
  token(id: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") {
    symbol
    name
    tradeVolume
    tradeVolumeUSD
    totalLiquidity
  }
}
```

## Deployment

This subgraph is deployed on The Graph's hosted service. You can find it at [INSERT_SUBGRAPH_URL_HERE].

## Development

To modify or extend this subgraph:

1. Clone the repository: `git clone https://github.com/metastable-labs/subgraph`
2. Install dependencies: `yarn install`
3. Make your changes to the schema, mappings, or configurations
4. Generate types: `graph codegen`
5. Build the subgraph: `graph build`
6. Deploy to The Graph: `graph deploy --studio liquid-aerodrome`

## Contributing

Contributions to improve the subgraph are welcome. Please submit issues and pull requests to the GitHub repository.
