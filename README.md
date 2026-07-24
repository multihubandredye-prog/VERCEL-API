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

A API salva o cadastro Premium com os campos atuais abaixo.

Exemplo de usuário Premium ativo:

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


### Campos principais salvos no Firebase

| Campo | Descrição |
|---|---|
| `name` | Nome do usuário/cliente |
| `phone` | Número normalizado usado como identificador principal |
| `phoneMasked` | Número mascarado para exibição administrativa |
| `status` | Estado atual: `pending_activation`, `premium`, `cancelled` ou outros estados operacionais |
| `plan` | Plano/descrição informada na ativação ou solicitação |
| `project_expiration` | Data final da assinatura Premium no formato `yyyy-MM-dd` |
| `createdAt` | Data/hora em que o cadastro foi criado |
| `updatedAt` | Data/hora da última alteração do cadastro |
| `lastRequestAt` | Data/hora ISO da última solicitação Premium feita pelo app |
| `lastRequestAtBR` | Data/hora da última solicitação em formato brasileiro |
| `lastPaymentAt` | Data/hora do último pagamento confirmado pelo administrador |
| `lastActivatedDays` | Última quantidade de dias liberada pelo administrador |
| `requestedPlan` | Plano que o usuário solicitou pelo app |
| `requestedMonths` | Quantidade de meses inferida/solicitada pelo app, quando houver |
| `requestedAmount` | Valor informado na solicitação feita pelo app |
| `source` | Origem do cadastro, por exemplo `wca-app` ou `manual-admin` |
| `payments` | Histórico de ativações/pagamentos confirmados manualmente |

---

## Status usados

| Status | Descrição |
|---|---|
| `pending_activation` | Usuário solicitou Premium pelo app, mas o administrador ainda não confirmou pagamento/ativação |
| `premium` | Assinatura ativa |
| `expired` | Assinatura expirada; pode ser definido manualmente, mas normalmente a API calcula expiração quando `project_expiration` já passou |
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





### Explicação detalhada dos campos do `/api/premium/activate`

Exemplo completo:

```bash
curl -X POST "https://wca-api-three-alpha.vercel.app/api/premium/activate" \
  -H "x-admin-key: SUA_CHAVE_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Andredye Oliveira Melo",
    "phone": "558197573129",
    "days": 35,
    "amount": "35",
    "method": "pix",
    "note": "Plano de 30 dias com 5 dias adicionais"
  }'
```

#### `x-admin-key`

```http
x-admin-key: SUA_CHAVE_ADMIN
```

É a chave administrativa configurada na variável de ambiente:

```env
PREMIUM_ADMIN_KEY=SUA_CHAVE_ADMIN
```

Somente quem possui essa chave consegue ativar, renovar ou cancelar Premium. Sem essa chave, a API retorna erro de permissão.

---

#### `name`

```json
"name": "Andredye Oliveira Melo"
```

Nome do usuário que será salvo/atualizado no Firebase.

Uso:

- identificar o cliente no painel/admin;
- exibir o nome no retorno da API;
- gravar no documento do usuário.

Se o usuário já existir e você não enviar `name`, a API tenta manter o nome já salvo anteriormente.

---

#### `phone`

```json
"phone": "558197573129"
```

Número do telefone que será usado como identificador principal do Premium.

Esse número deve estar normalizado, preferencialmente com:

```txt
DDI + DDD + número
```

Exemplo:

```txt
55 81 97573 129
```

Enviado como:

```txt
558197573129
```

A API remove automaticamente caracteres que não são números. Então estes formatos também funcionam:

```txt
+55 (81) 97573-129
558197573129
```

Internamente, o documento no Firebase usa esse número como base do cadastro.

---

#### `days`

```json
"days": 35
```

Quantidade exata de dias que você quer liberar para o usuário.

Esse é o campo recomendado para seu controle manual.

Exemplos:

```json
"days": 5
```

Libera 5 dias.

```json
"days": 30
```

Libera 30 dias.

```json
"days": 35
```

Libera 35 dias.

```json
"days": 365
```

Libera 365 dias.

Regra importante:

- se o usuário não tem Premium ativo, os dias contam a partir de hoje;
- se o usuário ainda tem Premium ativo, os dias são somados à data de expiração atual.

Exemplo:

```txt
Premium atual vence: 10/08/2026
Você envia: days = 35
Nova expiração: 14/09/2026
```

Assim o usuário não perde os dias que ainda tinha.

---

#### `amount`

```json
"amount": "35"
```

Valor pago pelo usuário.

Esse campo é apenas informativo/administrativo. Ele serve para histórico e controle interno.

Ele não define automaticamente o tempo de Premium.

Quem define o tempo é:

```json
"days"
```

ou, se você preferir, uma data manual em:

```json
"expiration"
```

Exemplos de `amount`:

```json
"amount": "35"
```

```json
"amount": "100"
```

```json
"amount": "R$ 35,00"
```

Você pode salvar como número ou texto. Recomendado usar texto para evitar problema com vírgula/moeda.

No Firebase, esse valor fica registrado dentro do histórico:

```json
"payments": [
  {
    "amount": "35"
  }
]
```

---

#### `method`

```json
"method": "pix"
```

Método de pagamento usado.

Exemplos:

```json
"method": "pix"
```

```json
"method": "cartao"
```

```json
"method": "dinheiro"
```

```json
"method": "manual"
```

Esse campo também é informativo e fica salvo no histórico de pagamentos.

---

#### `note`

```json
"note": "Plano de 30 dias com 5 dias adicionais"
```

Observação livre para você lembrar o motivo daquela ativação/renovação.

Exemplos:

```json
"note": "Pagamento confirmado via Pix"
```

```json
"note": "Cliente ganhou 5 dias de bônus"
```

```json
"note": "Renovação manual feita pelo administrador"
```

Esse campo não altera a lógica da API. Ele só fica salvo no histórico para consulta futura.

---

### Campos opcionais alternativos

#### `expiration`

```json
"expiration": "2026-08-27"
```

Define uma data exata de expiração.

Se você enviar `expiration`, ela tem prioridade sobre `days` e `months`.

Ordem de prioridade:

```txt
expiration > days > months
```

Exemplo:

```json
{
  "phone": "558197573129",
  "expiration": "2026-12-31"
}
```

A assinatura ficará válida até:

```txt
31/12/2026
```

---

#### `months`

```json
"months": 1
```

Campo antigo para ativar por quantidade de meses.

Ainda funciona, mas para seu fluxo atual o recomendado é usar:

```json
"days"
```

---

### O que é salvo no Firebase ao ativar

Quando você chama `/api/premium/activate`, a API atualiza o documento do usuário e salva informações como:

```json
{
  "name": "Andredye Oliveira Melo",
  "phone": "558197573129",
  "phoneMasked": "5581****3129",
  "status": "premium",
  "project_expiration": "2026-08-27",
  "lastActivatedDays": 35,
  "lastPaymentAt": "2026-07-23T22:00:00.000Z",
  "updatedAt": "2026-07-23T22:00:00.000Z",
  "payments": [
    {
      "date": "2026-07-23T22:00:00.000Z",
      "days": 35,
      "months": 0,
      "amount": "35",
      "method": "pix",
      "note": "Plano de 30 dias com 5 dias adicionais"
    }
  ]
}
```

---

### Resumo rápido dos campos

| Campo | Obrigatório | Função |
|---|---:|---|
| `phone` | Sim | Identifica o usuário Premium |
| `name` | Recomendado | Nome do usuário salvo no Firebase |
| `days` | Recomendado | Quantidade exata de dias liberados |
| `amount` | Opcional | Valor pago, apenas para histórico |
| `method` | Opcional | Método de pagamento, exemplo `pix` |
| `note` | Opcional | Observação administrativa |
| `expiration` | Opcional | Define uma data exata e ignora `days` |
| `months` | Opcional | Forma antiga de ativar por meses |


### Ativar Premium por quantidade exata de dias

O endpoint administrativo também aceita `days` ou `dias`. Essa é a forma recomendada quando você, como administrador, quer escolher exatamente quantos dias o usuário terá de acesso, independente do plano que ele solicitou no app.

Exemplo: usuário pediu 30 dias, mas você quer liberar 35 dias:

```bash
curl -X POST "https://wca-api-three-alpha.vercel.app/api/premium/activate" \
  -H "x-admin-key: SUA_CHAVE_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Andredye Oliveira Melo",
    "phone": "558197573129",
    "days": 35,
    "amount": "35",
    "method": "pix",
    "note": "Plano de 30 dias com 5 dias adicionais"
  }'
```

Resposta:

```json
{
  "success": true,
  "message": "Premium ativado com sucesso.",
  "phone": "558197573129",
  "status": "premium",
  "days": 35,
  "expiration": "2026-08-27"
}
```

Ordem de prioridade para calcular a expiração:

```txt
expiration/expiracao > days/dias > months/meses
```

Se o usuário ainda tiver Premium ativo, os dias são somados a partir da data de expiração atual. Se estiver vencido ou sem Premium, os dias contam a partir de hoje.

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



## Excluir usuário Premium completamente

Endpoint administrativo para remover completamente o documento do usuário da coleção `users` no Firebase.

Use este endpoint quando quiser apagar um cadastro de teste, solicitação errada, lixo ou usuário que não deve manter histórico.

> Para clientes reais, normalmente é melhor usar `/api/premium/cancel`, porque cancelar mantém histórico de pagamentos. O delete remove o documento.

### Opção 1 — POST

```http
POST /api/premium/delete
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
curl -X POST "https://wca-api-three-alpha.vercel.app/api/premium/delete" \
  -H "x-admin-key: SUA_CHAVE_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "558197573129"
  }'
```

Resposta de sucesso:

```json
{
  "success": true,
  "message": "Usuário Premium removido com sucesso.",
  "phone": "558197573129",
  "documentId": "558197573129",
  "deleted": true
}
```

### Opção 2 — DELETE

```bash
curl -X DELETE "https://wca-api-three-alpha.vercel.app/api/premium/delete?phone=558197573129" \
  -H "x-admin-key: SUA_CHAVE_ADMIN"
```

### Possíveis erros

Usuário não encontrado:

```json
{
  "success": false,
  "error": "Usuário não encontrado",
  "phone": "558197573129"
}
```

Chave administrativa inválida:

```json
{
  "success": false,
  "error": "Chave administrativa inválida"
}
```

### Diferença entre cancelar e excluir

| Ação | Endpoint | Resultado |
|---|---|---|
| Cancelar | `/api/premium/cancel` | Mantém o documento e histórico, muda `status` para `cancelled` |
| Excluir | `/api/premium/delete` | Remove completamente o documento do Firebase |




## Histórico Premium do usuário

Endpoint público para o app consultar o histórico Premium do próprio número conectado.

```http
GET /api/premium/history?phone=558197573129
```

Exemplo:

```bash
curl "https://wca-api-three-alpha.vercel.app/api/premium/history?phone=558197573129"
```

Resposta:

```json
{
  "success": true,
  "phone": "558197573129",
  "phoneMasked": "5581****3129",
  "name": "Andredye Oliveira Melo",
  "status": "premium",
  "currentExpiration": "2026-08-27",
  "history": [
    {
      "index": 1,
      "activatedAt": "2026-07-23T22:00:00.000Z",
      "periodStart": "2026-07-23",
      "periodEnd": "2026-08-27",
      "days": 35,
      "months": 0,
      "amount": "35",
      "method": "pix",
      "note": "Plano de 30 dias com 5 dias adicionais"
    }
  ],
  "requests": [
    {
      "requestedAt": "2026-07-23T21:50:00.000Z",
      "requestedAtBR": "23/07/2026, 18:50:00",
      "plan": "1 mês",
      "months": 1,
      "amount": "35",
      "status": "premium"
    }
  ]
}
```

### Campos do histórico

| Campo | Descrição |
|---|---|
| `activatedAt` | Data/hora em que o administrador ativou/renovou o Premium |
| `periodStart` | Data inicial considerada para aquele período |
| `periodEnd` | Data final daquele período |
| `days` | Quantidade de dias liberada, quando ativado por dias |
| `months` | Quantidade de meses, quando usado modo antigo por meses |
| `amount` | Valor informado pelo administrador |
| `method` | Método de pagamento informado, exemplo `pix` |
| `note` | Observação administrativa salva na ativação |


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
