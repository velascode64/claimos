# Payout — Technical Architecture

## 1. Goal técnico

Construir un MVP EVM que permita:

* Ingresar una wallet/ENS.
* Detectar actividad relevante y rewards/airdrops reclamables.
* Confirmar eligibility.
* Preparar el claim.
* Analizar la transacción antes de firmar.
* Permitir que el usuario apruebe y ejecute el claim.

Flujo mental:

**Discover → Confirm → Verify → Approve → Claim**

---

## 2. Tecnologías y APIs principales

| Tecnología            | Rol                                      | API / capacidad principal                        |
| --------------------- | ---------------------------------------- | ------------------------------------------------ |
| **The Graph**         | Descubrir actividad onchain de la wallet | Subgraphs / standardized data                    |
| **Merkl**             | Detectar rewards reales                  | Rewards API por address                          |
| **Claim Adapters**    | Cubrir claims fuera de Merkl             | Integraciones propias por protocolo/distributor  |
| **Alchemy**          | Simulación y Seguridad                   | Transaction simulation + asset changes (Alchemy Simulation API) |
| **Bazantic**          | Orquestación                             | Workflow entre Graph, Merkl, adapters y Alchemy  |
| **Privy**             | Wallet UX                                | Connect wallet + transaction/signing flow        |
| **Ledger**            | Human-in-the-loop                        | Aprobación segura de la transacción final        |
| **Supabase/Postgres** | Estado del producto                      | scans, claims, cache, resultados                 |

---

## 3. Flujo de arquitectura

```text
                         USER
                          │
                    Wallet / ENS
                          │
                          ▼
                     FRONTEND
                  Next.js / React
                          │
                          ▼
                    PAYOUT API
                          │
                          ▼
                      BAZANTIC
                    Orchestration
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
        THE GRAPH       MERKL       ADAPTERS
        activity        rewards     other claims
             │            │            │
             └────────────┼────────────┘
                          │
                          ▼
                     CLAIM ENGINE
              normalize / deduplicate
                   eligibility / price
                           │
                           ▼
                        ALCHEMY
                 simulation / assets
                           │
                           ▼
                        PRIVY
                  wallet connection
                          │
                          ▼
                       LEDGER
                   human approval
                          │
                          ▼
                OFFICIAL CONTRACT
                          │
                          ▼
                    USER WALLET
```

---

## 4. Diseño de backend y APIs

Para hackathon: **monolito modular**, no microservicios.

```text
/src
 ├── graph/
 ├── merkl/
 ├── adapters/
 ├── claims/
 ├── security/
 ├── workflows/
 ├── wallet/
 └── ledger/
```

APIs principales:

```text
POST /api/scan
```

Recibe wallet/ENS y devuelve claims encontrados.

```text
GET /api/claims/:id
```

Detalle + evidencia de eligibility.

```text
POST /api/claims/:id/prepare
```

Construye la transacción oficial.

```text
POST /api/claims/:id/verify
```

Envía la transacción a Alchemy Simulation API (`alchemy_simulateAssetChanges`) y devuelve balance diff, gas y verificación de seguridad.

```text
POST /api/claims/:id/execute
```

Inicia el flujo de firma/claim.

Objeto central:

```ts
type Claimable = {
  protocol: string;
  chainId: number;
  token: string;
  amount: string;
  usdValue: number;
  source: string;
  status: "confirmed" | "potential" | "claimed";
  claimTransaction?: unknown;
};
```

---

## 5. Restricciones del MVP

Para no desviarnos:

* **Solo EVM.**
* No Solana.
* No construir nuestro propio simulador o detector: usar **Alchemy Simulation API**.
* No construir nuestra propia wallet: usar **Privy / wallets existentes**.
* No intentar soportar todos los airdrops.
* Empezar con **Merkl + pocos adapters reales**.
* The Graph se usa para actividad/contexto, **no para inventar eligibility**.
* Solo contar en `$X found` claims **confirmados**.
* No predecir airdrops futuros.
* No construir farming/points optimization.
* No construir portfolio management.
* No hacer swaps/cash-out en V1 salvo que sobre tiempo.
* No perseguir bounties que obliguen a deformar el producto.
* La AI puede ayudar a investigar/orquestar, pero **la seguridad final depende de datos determinísticos + Alchemy Simulation + aprobación humana**.
* Objetivo demo:

```text
1 wallet
   ↓
varias fuentes
   ↓
claims reales
   ↓
security check
   ↓
1 claim ejecutado
```

**Eso es el MVP.**
