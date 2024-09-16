import {
  PoolCreated as PoolCreatedEvent,
  SetCustomFee as SetCustomFeeEvent,
  SetFeeManager as SetFeeManagerEvent,
  SetPauseState as SetPauseStateEvent,
  SetPauser as SetPauserEvent,
  SetVoter as SetVoterEvent
} from "../generated/PoolFactory/PoolFactory"
import {
  PoolCreated,
  SetCustomFee,
  SetFeeManager,
  SetPauseState,
  SetPauser,
  SetVoter
} from "../generated/schema"

export function handlePoolCreated(event: PoolCreatedEvent): void {
  let entity = new PoolCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.token0 = event.params.token0
  entity.token1 = event.params.token1
  entity.stable = event.params.stable
  entity.pool = event.params.pool
  entity.param4 = event.params.param4

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSetCustomFee(event: SetCustomFeeEvent): void {
  let entity = new SetCustomFee(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pool = event.params.pool
  entity.fee = event.params.fee

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSetFeeManager(event: SetFeeManagerEvent): void {
  let entity = new SetFeeManager(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.feeManager = event.params.feeManager

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSetPauseState(event: SetPauseStateEvent): void {
  let entity = new SetPauseState(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.state = event.params.state

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSetPauser(event: SetPauserEvent): void {
  let entity = new SetPauser(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pauser = event.params.pauser

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSetVoter(event: SetVoterEvent): void {
  let entity = new SetVoter(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.voter = event.params.voter

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
