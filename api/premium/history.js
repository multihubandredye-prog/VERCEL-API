const { setCors, normalizePhone, getUserByPhone, publicStatusFromUser } = require('../_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido' });

  try {
    const phone = normalizePhone(req.query.phone);
    if (!phone || phone.length < 8) {
      return res.status(400).json({ success: false, error: 'Número de telefone inválido' });
    }

    const user = await getUserByPhone(phone);
    if (!user) {
      return res.status(200).json({
        success: true,
        phone,
        status: 'teste',
        history: [],
        requests: []
      });
    }

    const data = user.data || {};
    const publicStatus = publicStatusFromUser(user);
    const payments = Array.isArray(data.payments) ? data.payments : [];

    const history = payments.map((p, index) => ({
      index: index + 1,
      activatedAt: p.date || '',
      periodStart: p.periodStart || '',
      periodEnd: p.periodEnd || data.project_expiration || '',
      days: p.days || 0,
      months: p.months || 0,
      amount: p.amount || '',
      method: p.method || '',
      note: p.note || ''
    }));

    const requests = [];
    if (data.pendingRequest && String(data.pendingRequest.status || '').toLowerCase() === 'pending_activation') {
      requests.push({
        requestedAt: data.pendingRequest.lastRequestAt || '',
        requestedAtBR: data.pendingRequest.lastRequestAtBR || '',
        plan: data.pendingRequest.requestedPlan || '',
        months: data.pendingRequest.requestedMonths || '',
        amount: data.pendingRequest.requestedAmount || '',
        status: 'pending_activation'
      });
    } else if (data.lastRequestAt || data.lastRequestAtBR || data.requestedPlan) {
      requests.push({
        requestedAt: data.lastRequestAt || '',
        requestedAtBR: data.lastRequestAtBR || '',
        plan: data.requestedPlan || '',
        months: data.requestedMonths || '',
        amount: data.requestedAmount || '',
        status: data.status === 'premium' ? 'pending_activation' : (data.status || '')
      });
    }

    return res.status(200).json({
      success: true,
      phone,
      phoneMasked: data.phoneMasked || '',
      name: data.name || '',
      status: publicStatus.status,
      currentExpiration: data.project_expiration || '',
      history,
      requests
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao consultar histórico Premium' });
  }
};
