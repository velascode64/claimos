import { encodeFunctionData, isAddress } from "viem"
import type { Claimable, ClaimTransaction } from "@/backend/core/types"

const claimAbi = [{
  type: "function",
  name: "claim",
  stateMutability: "nonpayable",
  inputs: [
    { name: "users", type: "address[]" },
    { name: "tokens", type: "address[]" },
    { name: "amounts", type: "uint256[]" },
    { name: "proofs", type: "bytes32[][]" },
  ],
  outputs: [],
}] as const

export function prepareMerklClaim(claim: Claimable): ClaimTransaction {
  if (claim.source !== "merkl") throw new Error("Unsupported claim source")
  if (claim.status !== "confirmed") throw new Error("Only confirmed claims can be prepared")
  if (!claim.distributor || !isAddress(claim.distributor)) throw new Error(`No verified Merkl distributor configured for chain ${claim.chainId}`)
  if (!isAddress(claim.wallet) || !isAddress(claim.token.address)) throw new Error("Claim contains an invalid address")
  if (!claim.proof?.length) throw new Error("Merkl proof is missing")

  return {
    chainId: claim.chainId,
    from: claim.wallet,
    to: claim.distributor,
    value: "0x0",
    data: encodeFunctionData({
      abi: claimAbi,
      functionName: "claim",
      args: [[claim.wallet], [claim.token.address], [BigInt(claim.amount)], [claim.proof]],
    }),
  }
}

