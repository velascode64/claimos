import type { Claimable, ScanResult, SecurityCheck } from "@/backend/core/types"

class ClaimStore {
  private readonly scans = new Map<string, ScanResult>()
  private readonly claims = new Map<string, Claimable>()
  private readonly checks = new Map<string, SecurityCheck>()

  saveScan(scan: ScanResult) {
    this.scans.set(scan.scanId, scan)
    for (const claim of scan.claims) this.claims.set(claim.id, claim)
    return scan
  }

  getClaim(id: string) {
    return this.claims.get(id)
  }

  saveClaim(claim: Claimable) {
    this.claims.set(claim.id, claim)
    return claim
  }

  saveCheck(check: SecurityCheck) {
    this.checks.set(check.claimId, check)
    return check
  }

  getCheck(claimId: string) {
    return this.checks.get(claimId)
  }
}

export const claimStore = new ClaimStore()
