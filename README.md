# WCA Premium API

API Vercel para controle manual de assinatura Premium do Whats Connect API.

Esta API usa o Firebase Firestore como banco principal, na coleção:

```txt
users
```

A ideia é:

1. O usuário solicita Premium pelo app.
2. A API salva a solicitação como `pending_activation`.
3. O usuário realiza o pagamento manualmente para o administrador.
4. O administrador confirma o pagamento usando um endpoint protegido.
5. A API ativa/renova o Premium e grava a data de expiração.
6. O Java code do Tasker consulta a API e controla se o WCA fica ativo, teste ou expirado.

---

## Variáveis de ambiente

Configure na Vercel:

```env
FIREBASE_KEY=SUA_FIREBASE_WEB_API_KEY
FIREBASE_PROJECT_ID=projects-general-fed41
PREMIUM_ADMIN_KEY=SUA_CHAVE_ADMINISTRATIVA_FORTE
```

`PREMIUM_ADMIN_KEY` é obrigatória para endpoints administrativos.

Também são aceitos como fallback:

```env
ADMIN_KEY=
REVIEWS_ADMIN_KEY=
```

Mas o recomendado é usar:

```env
PREMIUM_ADMIN_KEY
```

---

## Modelo do documento no Firestore

Documento recomendado:

```txt
users/{phone}
```

O documento salvo no Firebase usa campos únicos em inglês para evitar duplicidade.

Exemplo:

```json
{
  "name": "Andredye Oliveira Melo",
  "phone": "558197573129",
  "phoneMasked": "5581****3129",
  "status": "premium",
  "plan": "1 mês",
  "project_expiration": "2026-08-23",
  "createdAt": "2026-07-23T10:00:00.000Z",
  "updatedAt": "2026-07-23T10:00:00.000Z",
  "lastRequestAt": "2026-07-23T09:50:00.000Z",
  "lastPaymentAt": "2026-07-23T10:00:00.000Z",
  "source": "wca-app",
  "payments": [
    {
      "date": "2026-07-23T10:00:00.000Z",
      "months": 1,
      "amount": "35",
      "method": "pix",
      "note": "Pagamento confirmado manualmente"
    }
  ]
}
```

### Campos que não são mais gravados no Firebase

Para evitar informação duplicada, a API não grava mais estes pares repetidos:

```txt
name / nome
createdAt / created_at
status / pendingStatus
project_expiration / expiration / expiracao
plan / plano
```

O armazenamento interno fica em inglês. A resposta pública da API ainda pode retornar `nome`, `expiracao`, `plano`, `modo` para manter compatibilidade com o Java/Tasker.

---

## Status usados

| Status | Descrição |
|---|---|
| `pending_activation` | Usuário solicitou Premium, mas o pagamento ainda não foi confirmado |
| `premium` | Assinatura ativa |
| `expired` | Assinatura expirada |
| `cancelled` | Assinatura cancelada manualmente |
| `teste` | Usuário sem Premium |

---

## 1. Consultar status pelo número

Endpoint usado pelo Java code do Tasker.

```http
GET /api?phone=558197573129
```

Exemplo:

```bash
curl "https://wca-api-three-alpha.vercel.app/api?phone=558197573129"
```

### Premium ativo

```json
{
  "nome": "Andredye Oliveira Melo",
  "expiracao": "2026-08-23",
  "status": "premium",
  "plano": "premium",
  "tipo": "premium",
  "modo": "PREMIUM"
}
```

### Premium expirado

```json
{
  "nome": "Andredye Oliveira Melo",
  "expiracao": "2026-07-20",
  "status": "expired",
  "plano": "premium",
  "tipo": "expired",
  "modo": "PREMIUM",
  "expired": true
}
```

### Solicitação pendente

```json
{
  "nome": "Andredye Oliveira Melo",
  "status": "pending_activation",
  "plano": "premium",
  "tipo": "pending_activation",
  "modo": "TESTE",
  "pending": true
}
```

### Sem cadastro ou sem Premium

```json
{
  "status": "teste",
  "plano": "teste",
  "tipo": "evaluation",
  "modo": "TESTE"
}
```

---

## 2. Solicitar Premium pelo app

Endpoint público. O usuário pode chamar este endpoint pelo app.

Ele **não ativa Premium**. Ele apenas cria/atualiza uma solicitação com status:

```txt
pending_activation
```

```http
POST /api/premium/request
Content-Type: application/json
```

Body:

```json
{
  "name": "Andredye Oliveira Melo",
  "phone": "558197573129",
  "plan": "1 mês",
  "months": 1,
  "amount": "35"
}
```

Exemplo cURL:

```bash
curl -X POST "https://wca-api-three-alpha.vercel.app/api/premium/request" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Andredye Oliveira Melo",
    "phone": "558197573129",
    "plan": "1 mês",
    "months": 1,
    "amount": "35"
  }'
```

Resposta:

```json
{
  "success": true,
  "message": "Solicitação Premium registrada com sucesso. Aguarde a confirmação do pagamento.",
  "status": "pending_activation",
  "phone": "558197573129",
  "phoneMasked": "5581****3129",
  "plan": "1 mês",
  "months": 1,
  "amount": "35"
}
```

---


### Atualizar solicitação pendente

Se o usuário errou o plano/nome antes da ativação, o app pode reenviar a solicitação com `updatePending: true`.

```bash
curl -X POST "https://wca-api-three-alpha.vercel.app/api/premium/request" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Andredye Oliveira Melo",
    "phone": "558197573129",
    "plan": "3 meses",
    "months": 3,
    "amount": "100",
    "updatePending": true
  }'
```

Isso atualiza a solicitação existente em `pending_activation`, em vez de criar uma duplicada.

## 3. Listar solicitações pendentes

Endpoint administrativo.

```http
GET /api/premium/pending
x-admin-key: SUA_CHAVE_ADMIN
```

Exemplo:

```bash
curl "https://wca-api-three-alpha.vercel.app/api/premium/pending" \
  -H "x-admin-key: SUA_CHAVE_ADMIN"
```

Resposta:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "phone": "558197573129",
      "name": "Andredye Oliveira Melo",
      "status": "pending_activation",
      "requestedPlan": "1 mês",
      "requestedMonths": 1,
      "requestedAmount": "35",
      "lastRequestAt": "2026-07-23T10:00:00.000Z"
    }
  ]
}
```

---

## 4. Ativar ou renovar Premium

Endpoint administrativo. Só você deve usar depois de confirmar o pagamento.

```http
POST /api/premium/activate
x-admin-key: SUA_CHAVE_ADMIN
Content-Type: application/json
```

Body:

```json
{
  "name": "Andredye Oliveira Melo",
  "phone": "558197573129",
  "plan": "1 mês",
  "months": 1,
  "amount": "35",
  "method": "pix",
  "note": "Pagamento confirmado manualmente"
}
```

Exemplo:

```bash
curl -X POST "https://wca-api-three-alpha.vercel.app/api/premium/activate" \
  -H "x-admin-key: SUA_CHAVE_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Andredye Oliveira Melo",
    "phone": "558197573129",
    "plan": "1 mês",
    "months": 1,
    "amount": "35",
    "method": "pix"
  }'
```

Resposta:

```json
{
  "success": true,
  "message": "Premium ativado com sucesso.",
  "phone": "558197573129",
  "status": "premium",
  "expiration": "2026-08-23",
  "expiracao": "2026-08-23"
}
```

### Regra de renovação

Se o usuário ainda tiver assinatura ativa, o novo período é somado à data de expiração atual.

Se a assinatura já estiver vencida, o novo período começa a contar a partir de hoje.

---

## 5. Cancelar Premium

Endpoint administrativo.

```http
POST /api/premium/cancel
x-admin-key: SUA_CHAVE_ADMIN
Content-Type: application/json
```

Body:

```json
{
  "phone": "558197573129"
}
```

Exemplo:

```bash
curl -X POST "https://wca-api-three-alpha.vercel.app/api/premium/cancel" \
  -H "x-admin-key: SUA_CHAVE_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "558197573129"
  }'
```

Resposta:

```json
{
  "success": true,
  "message": "Premium cancelado com sucesso.",
  "phone": "558197573129",
  "status": "cancelled"
}
```

---

## 6. Consultar usuário como admin

Endpoint administrativo.

```http
GET /api/premium/user?phone=558197573129
x-admin-key: SUA_CHAVE_ADMIN
```

Exemplo:

```bash
curl "https://wca-api-three-alpha.vercel.app/api/premium/user?phone=558197573129" \
  -H "x-admin-key: SUA_CHAVE_ADMIN"
```

---

## Fluxo completo manual

```txt
Usuário solicita Premium pelo app
↓
POST /api/premium/request
↓
Firebase salva status pending_activation
↓
Usuário paga manualmente via Pix/WhatsApp
↓
Administrador confirma pagamento
↓
POST /api/premium/activate com x-admin-key
↓
Firebase muda status para premium e salva data de expiração
↓
Java code do Tasker consulta GET /api?phone=...
↓
Tasker recebe premium, expired, pending_activation ou teste
```

---

## Segurança recomendada

Mesmo que o Firebase esteja temporariamente com regras abertas, o ideal é no futuro bloquear regras diretas e deixar apenas a API Vercel escrever no banco.

O endpoint público `/api/premium/request` nunca ativa Premium. Ele sempre salva solicitação como `pending_activation`.

Apenas endpoints com `x-admin-key` conseguem ativar ou cancelar Premium.
