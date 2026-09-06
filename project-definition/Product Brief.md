## Plan de la aplicación — MVP ETHOnline

### 1. Problema

* Los usuarios de crypto **buscan constantemente airdrops y rewards** porque pueden representar dinero real.
* La información está **fragmentada** entre X, Galxe, trackers, páginas de protocolos y herramientas de seguridad.
* Saber **“¿tengo algo para reclamar?”** requiere revisar varias fuentes.
* Cuando encuentran algo, aparece el segundo problema: **“¿esto es legítimo y qué estoy firmando?”**
* Los usuarios avanzados terminan combinando simuladores, explorers, Revoke, burner wallets y verificación manual.
* Aun con herramientas de seguridad, **la decisión final sigue recayendo sobre el usuario**.

### 2. Evidencia que hemos encontrado

* Hay una comunidad grande participando activamente en airdrops, quests y rewards.
* Los fake airdrops son un vector recurrente de wallet drainers porque imitan un comportamiento legítimo: **check eligibility → connect → claim**.
* Las soluciones actuales están separadas:

  * **Galxe / Drops / Merkl** → discovery y eligibility.
  * **Blockaid / wallet simulations** → seguridad.
  * **Ledger / hardware wallets** → aprobación.
  * **Revoke / burner wallets** → limitar daño.
* Estudios recientes muestran que incluso usuarios con experiencia **malinterpretan firmas y parámetros**, y que explicarlos semánticamente mejora la detección de riesgo.
* El workaround recurrente es **usar varias herramientas para completar un solo claim**.

---

# 3. Propuesta de valor

> **See what your wallet can claim, verify it, understand the transaction, and claim safely from one place.**

Más simple:

> **Find money waiting for your wallet. Claim it with confidence.**

El producto une:

**Discover → Verify eligibility → Explain → Security check → Approve → Claim**

---

# 4. Flujo de pantallas

### Pantalla 1 — Home / Check Wallet

**Objetivo:** entrar por la atracción principal: “¿tengo dinero esperando?”

* Campo: `0x...` / ENS.
* No requiere conectar wallet.
* CTA: **Check my wallet**.
* Mensaje de confianza: *No signature required to scan.*

```text
You may have money waiting onchain.

[ carlos.eth             ]

      Check my wallet
```

---

### Pantalla 2 — Scanning

**Objetivo:** mostrar qué estamos comprobando.

* Buscar actividad onchain.
* Consultar fuentes de rewards.
* Revisar distribuciones conocidas.
* Verificar eligibility.

```text
Scanning your wallet...

✓ Checking wallet activity
✓ Checking reward programs
✓ Checking known distributions
✓ Verifying eligibility
```

**Backend:** The Graph + Merkl + adapters.

---

### Pantalla 3 — Results

**Objetivo:** responder inmediatamente:

> **¿Cuánto puedo reclamar?**

```text
$428.31 found

3 rewards ready to claim

Merkl Reward             $83.20
Protocol Airdrop        $287.11
Staking Reward           $58.00
```

Cada resultado debe distinguir:

* ✅ **Confirmed claimable**
* 🟡 **Potential / not verified**
* ❌ **Not eligible**

Solo lo confirmado suma al `$428`.

---

### Pantalla 4 — Claim Detail

**Objetivo:** responder:

> **¿Por qué este dinero me corresponde?**

```text
Protocol Airdrop
$287.11

Why you're eligible

✓ Used Protocol X
✓ Activity before snapshot
✓ Wallet appears in official distribution
✓ Claim is still active

Official contract:
0x83...91D
```

Aquí reducimos la necesidad de ir a X, Discord o Etherscan a investigar manualmente.

---

### Pantalla 5 — Security Check

**Objetivo:** responder la pregunta crítica:

> **¿Qué va a pasar si firmo?**

Blockaid analiza/simula la transacción.

La UI lo traduce:

```text
Security Check

✓ Official claim contract
✓ No unlimited token approvals
✓ No unexpected token transfers
✓ Tokens will be sent to your wallet

This transaction will:

Receive:
+ 184 XYZ ($287.11)

Spend:
Gas ~$0.42

Risk:
LOW
```

No mostrar calldata técnica como explicación principal.

---

### Pantalla 6 — Connect & Approve

**Objetivo:** recién aquí pedir acceso a la wallet.

* Privy maneja la UX/conexión.
* Ledger puede ser la capa de **human-in-the-loop**.

```text
Everything looks good.

$287.11 ready to claim

[ Connect wallet ]

        ↓

Ledger

Review and approve
```

El sistema prepara todo; **el usuario conserva la decisión final**.

---

### Pantalla 7 — Claim Success

**Objetivo:** cerrar el reward loop.

```text
✓ Claimed

+184 XYZ
$287.11

sent to

0xCarlos...
```

Opcionalmente:

**Check for more rewards**

---

# 5. Arquitectura detrás del flujo

```text
Wallet / ENS
     ↓
 THE GRAPH
wallet activity
     ↓
MERKL + ADAPTERS
claim discovery / eligibility
     ↓
 CLAIM ENGINE
normalize results
     ↓
  BLOCKAID
simulation / security
     ↓
  BAZANTIC
workflow orchestration
     ↓
 PRIVY
wallet interaction
     ↓
 LEDGER
human approval
     ↓
CLAIM CONTRACT
     ↓
   Wallet
```

### Qué aporta cada sponsor

* **The Graph:** *¿Qué hizo esta wallet?*
* **Merkl/adapters:** *¿Tiene realmente algo para reclamar?*
* **Blockaid:** *¿Qué ocurrirá si ejecutamos esto y hay señales de riesgo?*
* **Bazantic:** conecta el workflow.
* **Privy:** interacción fluida con la wallet.
* **Ledger:** aprobación humana de la acción irreversible.

## MVP de hackathon

No intentaría cubrir todos los airdrops. El MVP necesita demostrar solamente:

**1 wallet → varias fuentes → 3 claims reales → explicación → security check → 1 claim ejecutado.**

Eso prueba la propuesta de valor completa sin intentar construir toda la infraestructura de rewards de Ethereum en diez días.
