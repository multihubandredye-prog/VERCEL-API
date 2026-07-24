const { setCors, readBody, normalizePhone, maskPhone, inferMonths, getPlanAmount, getUserByPhone, saveUser, isAdminRequest, addDaysYmd, addMonthsYmd, isFutureOrToday, todayYmd, cleanUserData, normalizePendingRequest } = require('../_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido' });

  const body = await readBody(req);
  req.body = body;
  if (!isAdminRequest(req)) return res.status(403).json({ success: false, error: 'Chave administrativa inválida' });

  try {
    const phone = normalizePhone(body.phone);
    const name = String(body.name || body.nome || '').trim();
    const plan = String(body.plan || body.plano || '').trim();
    const months = inferMonths(plan, body.months || body.meses) || 1;
    const rawDays = body.days !== undefined ? body.days : body.dias;
    const days = Number(rawDays);
    const hasValidDays = Number.isFinite(days) && days > 0;
    const amount = getPlanAmount(plan, body.amount || body.valor);
    if (!phone || phone.length < 8) return res.status(400).json({ success: false, error: 'Número de telefone inválido' });

    const existing = await getUserByPhone(phone);
    const old = cleanUserData(existing ? existing.data : {});
    const pendingRequest = normalizePendingRequest(old);
    delete old.pendingRequest;
    const hasActiveExpiration = isFutureOrToday(old.project_expiration);
    const baseExpiration = hasActiveExpiration ? old.project_expiration : todayYmd();
    const periodStart = baseExpiration;
    const expiration = body.expiration || body.expiracao || (hasValidDays
      ? addDaysYmd(baseExpiration, days)
      : addMonthsYmd(baseExpiration, body.months || body.meses || months));
    const finalName = name || old.name || old.nome || 'Premium';
    const now = new Date().toISOString();

    const payment = {
      date: now,
      periodStart,
      periodEnd: expiration,
      days: hasValidDays ? days : 0,
      months: hasValidDays ? 0 : Number(body.months || body.meses || months),
      amount,
      method: body.method || body.metodo || 'manual',
      note: body.note || body.observacao || '',
      fromRequest: pendingRequest ? {
        requestedPlan: pendingRequest.requestedPlan || '',
        requestedMonths: pendingRequest.requestedMonths || '',
        requestedAmount: pendingRequest.requestedAmount || '',
        lastRequestAt: pendingRequest.lastRequestAt || '',
        lastRequestAtBR: pendingRequest.lastRequestAtBR || ''
      } : {}
    };
    const payments = Array.isArray(old.payments) ? [...old.payments, payment] : [payment];

    const payload = {
      ...old,
      name: finalName,
      phoneMasked: maskPhone(phone),
      status: 'premium',
      plan: plan || old.plan || (hasValidDays ? `${days} dias` : 'manual'),
      lastActivatedDays: hasValidDays ? days : 0,
      project_expiration: expiration,
      lastPaymentAt: now,
      updatedAt: now,
      createdAt: old.createdAt || now,
      payments,
      source: old.source || 'manual-admin'
    };

    await saveUser(phone, payload);
    return res.status(200).json({
      success: true,
      message: 'Premium ativado com sucesso.',
      phoneMasked: payload.phoneMasked,
      status: 'premium',
      days: hasValidDays ? days : undefined,
      months: hasValidDays ? undefined : Number(body.months || body.meses || months),
      expiration,
      expiracao: expiration,
      pendingRequestCleared: !!pendingRequest,
      user: payload
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao ativar Premium' });
  }
};
