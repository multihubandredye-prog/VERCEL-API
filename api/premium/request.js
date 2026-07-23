const { setCors, readBody, normalizePhone, maskPhone, inferMonths, getPlanAmount, getUserByPhone, saveUser, publicStatusFromUser, cleanUserData } = require('../_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido' });

  try {
    const body = await readBody(req);
    const phone = normalizePhone(body.phone);
    const name = String(body.name || body.nome || '').trim();
    const plan = String(body.plan || body.plano || '1 mês').trim();
    const months = inferMonths(plan, body.months || body.meses);
    const amount = getPlanAmount(plan, body.amount || body.valor);

    if (!phone || phone.length < 8) return res.status(400).json({ success: false, error: 'Número de telefone inválido' });
    if (!name || name.length < 2) return res.status(400).json({ success: false, error: 'Nome obrigatório' });

    const now = new Date().toISOString();
    const existing = await getUserByPhone(phone);
    const old = cleanUserData(existing ? existing.data : {});
    const payload = {
      ...old,
      name,
      phone,
      phoneMasked: maskPhone(phone),
      status: publicStatusFromUser(existing).status === 'premium' ? 'premium' : 'pending_activation',
      requestedPlan: plan,
      requestedMonths: months,
      requestedAmount: amount,
      lastRequestAt: now,
      updatedAt: now,
      createdAt: old.createdAt || now,
      source: 'wca-app'
    };

    await saveUser(phone, payload);
    return res.status(200).json({
      success: true,
      message: 'Solicitação Premium registrada com sucesso. Aguarde a confirmação do pagamento.',
      status: payload.status,
      phone,
      phoneMasked: payload.phoneMasked,
      plan,
      months,
      amount
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao registrar solicitação Premium' });
  }
};
