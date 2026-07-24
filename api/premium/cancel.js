const { setCors, readBody, normalizePhone, maskPhone, getUserByPhone, saveUser, isAdminRequest, todayYmd, cleanUserData } = require('../_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido' });

  const body = await readBody(req);
  req.body = body;
  if (!isAdminRequest(req)) return res.status(403).json({ success: false, error: 'Chave administrativa inválida' });

  try {
    const phone = normalizePhone(body.phone);
    if (!phone || phone.length < 8) return res.status(400).json({ success: false, error: 'Número de telefone inválido' });
    const existing = await getUserByPhone(phone);
    const old = cleanUserData(existing ? existing.data : {});
    const now = new Date().toISOString();
    const payload = {
      ...old,
      phoneMasked: old.phoneMasked || maskPhone(phone),
      status: 'cancelled',
      cancelledAt: now,
      updatedAt: now,
      project_expiration: body.expiration || body.expiracao || todayYmd()
    };
    await saveUser(phone, payload);
    return res.status(200).json({ success: true, message: 'Premium cancelado com sucesso.', phoneMasked: payload.phoneMasked, status: 'cancelled' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao cancelar Premium' });
  }
};
