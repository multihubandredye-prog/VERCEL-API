const { setCors, readBody, normalizePhone, maskPhone, getUserByPhone, saveUser, deleteUserByPhone, publicStatusFromUser, cleanUserData, normalizePendingRequest } = require('../_premium');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido' });

  try {
    const body = await readBody(req);
    const phone = normalizePhone(body.phone || req.query.phone);
    if (!phone || phone.length < 8) {
      return res.status(400).json({ success: false, error: 'Número de telefone inválido' });
    }

    const existing = await getUserByPhone(phone);
    if (!existing) {
      return res.status(200).json({
        success: true,
        message: 'Nenhuma solicitação pendente encontrada para este número.',
        phoneMasked: maskPhone(phone),
        cancelled: false
      });
    }

    const old = cleanUserData(existing.data || {});
    const pendingRequest = normalizePendingRequest(old);
    if (!pendingRequest) {
      return res.status(200).json({
        success: true,
        message: 'Nenhuma solicitação pendente encontrada para este número.',
        phoneMasked: old.phoneMasked || maskPhone(phone),
        cancelled: false,
        status: publicStatusFromUser(existing).status
      });
    }

    const publicStatus = publicStatusFromUser(existing);
    const now = new Date().toISOString();

    // Se o usuário já é Premium, cancela somente a renovação pendente e preserva o cadastro/assinatura.
    if (publicStatus.status === 'premium' || publicStatus.status === 'expired') {
      delete old.pendingRequest;
      const payload = {
        ...old,
        updatedAt: now
      };
      await saveUser(phone, payload);
      return res.status(200).json({
        success: true,
        message: 'Solicitação pendente cancelada com sucesso.',
        phoneMasked: payload.phoneMasked || maskPhone(phone),
        cancelled: true,
        status: publicStatus.status
      });
    }

    // Se era apenas uma solicitação inicial pendente, remove o documento para voltar ao estado sem cadastro Premium.
    const result = await deleteUserByPhone(phone);
    return res.status(200).json({
      success: true,
      message: 'Solicitação pendente cancelada com sucesso.',
      phoneMasked: maskPhone(phone),
      cancelled: true,
      deleted: !!result.deleted,
      status: 'teste'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Erro ao cancelar solicitação Premium' });
  }
};
