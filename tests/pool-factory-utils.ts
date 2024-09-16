import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  PoolCreated,
  SetCustomFee,
  SetFeeManager,
  SetPauseState,
  SetPauser,
  SetVoter
} from "../generated/PoolFactory/PoolFactory"

export function createPoolCreatedEvent(
  token0: Address,
  token1: Address,
  stable: boolean,
  pool: Address,
  param4: BigInt
): PoolCreated {
  let poolCreatedEvent = changetype<PoolCreated>(newMockEvent())

  poolCreatedEvent.parameters = new Array()

  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("token0", ethereum.Value.fromAddress(token0))
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("token1", ethereum.Value.fromAddress(token1))
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("stable", ethereum.Value.fromBoolean(stable))
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("param4", ethereum.Value.fromUnsignedBigInt(param4))
  )

  return poolCreatedEvent
}

export function createSetCustomFeeEvent(
  pool: Address,
  fee: BigInt
): SetCustomFee {
  let setCustomFeeEvent = changetype<SetCustomFee>(newMockEvent())

  setCustomFeeEvent.parameters = new Array()

  setCustomFeeEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  setCustomFeeEvent.parameters.push(
    new ethereum.EventParam("fee", ethereum.Value.fromUnsignedBigInt(fee))
  )

  return setCustomFeeEvent
}

export function createSetFeeManagerEvent(feeManager: Address): SetFeeManager {
  let setFeeManagerEvent = changetype<SetFeeManager>(newMockEvent())

  setFeeManagerEvent.parameters = new Array()

  setFeeManagerEvent.parameters.push(
    new ethereum.EventParam(
      "feeManager",
      ethereum.Value.fromAddress(feeManager)
    )
  )

  return setFeeManagerEvent
}

export function createSetPauseStateEvent(state: boolean): SetPauseState {
  let setPauseStateEvent = changetype<SetPauseState>(newMockEvent())

  setPauseStateEvent.parameters = new Array()

  setPauseStateEvent.parameters.push(
    new ethereum.EventParam("state", ethereum.Value.fromBoolean(state))
  )

  return setPauseStateEvent
}

export function createSetPauserEvent(pauser: Address): SetPauser {
  let setPauserEvent = changetype<SetPauser>(newMockEvent())

  setPauserEvent.parameters = new Array()

  setPauserEvent.parameters.push(
    new ethereum.EventParam("pauser", ethereum.Value.fromAddress(pauser))
  )

  return setPauserEvent
}

export function createSetVoterEvent(voter: Address): SetVoter {
  let setVoterEvent = changetype<SetVoter>(newMockEvent())

  setVoterEvent.parameters = new Array()

  setVoterEvent.parameters.push(
    new ethereum.EventParam("voter", ethereum.Value.fromAddress(voter))
  )

  return setVoterEvent
}
