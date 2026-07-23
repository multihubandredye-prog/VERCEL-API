const { setCors, readBody, normalizePhone, maskPhone, inferMonths, getPlanAmount, getUserByPhone, saveUser, isAdminRequest, addMonthsYmd, isFutureOrToday, todayYmd } = require('../_premium');

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
    const months = inferMonths(plan, body.months || body.meses || body.days ? undefined : undefined) || 1;
    const amount = getPlanAmount(plan, body.amount || body.valor);
    if (!phone || phone.length < 8) return res.status(400).json({ success: false, error: 'Número de telefone inválido' });

    const existing = await getUserByPhone(phone);
    const old = existing ? existing.data : {};
    const baseExpiration = isFutureOrToday(old.project_expiration) ? old.project_expiration : todayYmd();
    const expiration = body.expiration || body.expiracao || addMonthsYmd(baseExpiration, body.months || body.meses || months);
    const finalName = name || old.name || old.nome || 'Premium';
    const now = new Date().toISOString();

    const payment = {
      date: now,
      months: Number(body.months || body.meses || months),
      amount,
      method: body.method || body.metodo || 'manual',
      note: body.note || body.observacao || ''
    };
    const payments = Array.isArray(old.payments) ? [...old.payments, payment] : [payment];

    const payload = {
      ...old,
      name: finalName,
      nome: finalName,
      phone,
      phoneMasked: maskPhone(phone),
      status: 'premium',
      plan: plan || old.plan || 'manual',
      plano: 'premium',
      project_expiration: expiration,
      expiration,
      lastPaymentAt: now,
      updatedAt: now,
      createdAt: old.createdAt || now,
      payments,
      source: old.source || 'manual-admin'
    };

    await saveUser(phone, payload);
    return res.status(200).json({ success: true, message: 'Premium ativado com sucesso.', phone, status: 'premium', expiration, expiracao: expiration, user: payload });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao ativar Premium' });
  }
};
