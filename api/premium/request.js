const { setCors, readBody, normalizePhone, maskPhone, inferMonths, getPlanAmount, getUserByPhone, saveUser, publicStatusFromUser, cleanUserData, nowBrazil, normalizePendingRequest } = require('../_premium');

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
    const updatePending = body.updatePending === true || body.updatePending === 'true' || body.edit === true || body.edit === 'true';

    if (!phone || phone.length < 8) return res.status(400).json({ success: false, error: 'Número de telefone inválido' });
    if (!name || name.length < 2) return res.status(400).json({ success: false, error: 'Nome obrigatório' });

    const now = new Date().toISOString();
    const nowBR = nowBrazil();
    const existing = await getUserByPhone(phone);
    const publicStatus = publicStatusFromUser(existing);
    const old = cleanUserData(existing ? existing.data : {});
    const currentPending = normalizePendingRequest(old);
    const isPremiumActive = publicStatus.status === 'premium';

    if (currentPending && !updatePending) {
      return res.status(200).json({
        success: true,
        alreadyPending: true,
        message: 'Já existe uma solicitação Premium pendente para este número. Aguarde o retorno do desenvolvedor.',
        status: 'pending_activation',
        phoneMasked: old.phoneMasked || maskPhone(phone),
        plan: currentPending.requestedPlan || plan,
        months: currentPending.requestedMonths || months,
        amount: currentPending.requestedAmount || amount,
        lastRequestAt: currentPending.lastRequestAt || '',
        lastRequestAtBR: currentPending.lastRequestAtBR || ''
      });
    }

    const pendingRequest = {
      status: 'pending_activation',
      requestedPlan: plan,
      requestedMonths: months,
      requestedAmount: amount,
      lastRequestAt: now,
      lastRequestAtBR: nowBR
    };

    const payload = isPremiumActive
      ? {
          ...old,
          name,
          phoneMasked: old.phoneMasked || maskPhone(phone),
          status: 'premium',
          pendingRequest,
          updatedAt: now,
          source: old.source || 'wca-app'
        }
      : {
          ...old,
          name,
          phoneMasked: maskPhone(phone),
          status: 'pending_activation',
          requestedPlan: plan,
          requestedMonths: months,
          requestedAmount: amount,
          lastRequestAt: now,
          lastRequestAtBR: nowBR,
          updatedAt: now,
          createdAt: old.createdAt || now,
          source: 'wca-app'
        };

    await saveUser(phone, payload);
    return res.status(200).json({
      success: true,
      updated: updatePending,
      message: updatePending
        ? 'Solicitação Premium atualizada com sucesso. Aguarde o retorno do desenvolvedor.'
        : 'Solicitação Premium registrada com sucesso. Aguarde o retorno do desenvolvedor.',
      status: 'pending_activation',
      phoneMasked: old.phoneMasked || maskPhone(phone),
      plan,
      months,
      amount,
      lastRequestAt: pendingRequest.lastRequestAt,
      lastRequestAtBR: pendingRequest.lastRequestAtBR
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao registrar solicitação Premium' });
  }
};
