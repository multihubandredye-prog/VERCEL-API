const { setCors, readBody, normalizePhone, maskPhone, inferMonths, getPlanAmount, getUserByPhone, saveUser, publicStatusFromUser, cleanUserData, nowBrazil } = require('../_premium');

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
    const publicStatus = publicStatusFromUser(existing);
    const old = cleanUserData(existing ? existing.data : {});

    if (String(old.status || '').toLowerCase() === 'pending_activation') {
      return res.status(200).json({
        success: true,
        alreadyPending: true,
        message: 'Já existe uma solicitação Premium pendente para este número. Aguarde o contato do desenvolvedor.',
        status: 'pending_activation',
        phone,
        phoneMasked: old.phoneMasked || maskPhone(phone),
        plan: old.requestedPlan || plan,
        months: old.requestedMonths || months,
        amount: old.requestedAmount || amount,
        lastRequestAt: old.lastRequestAt || '',
        lastRequestAtBR: old.lastRequestAtBR || old.requestedAtBR || ''
      });
    }

    const payload = {
      ...old,
      name,
      phone,
      phoneMasked: maskPhone(phone),
      status: publicStatus.status === 'premium' ? 'premium' : 'pending_activation',
      requestedPlan: plan,
      requestedMonths: months,
      requestedAmount: amount,
      lastRequestAt: now,
      lastRequestAtBR: nowBrazil(),
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
      amount,
      lastRequestAt: payload.lastRequestAt,
      lastRequestAtBR: payload.lastRequestAtBR
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao registrar solicitação Premium' });
  }
};
