const { query } = require('./connection');

async function saveMessage(payload = {}) {
  const whatsappMessageId =
    payload.whatsappMessageId ||
    payload.whatsapp_message_id ||
    payload.messageId ||
    null;

  const sender =
    payload.sender ||
    payload.from ||
    payload.phone ||
    'unknown';

  const body =
    payload.body ??
    payload.text ??
    null;

  const messageType =
    payload.messageType ||
    payload.message_type ||
    'text';

  const direction =
    payload.direction ||
    'incoming';

  const rawPayload =
    payload.rawPayload ||
    payload.raw_payload ||
    payload;

  const result = await query(
    `
      INSERT INTO messages (
        whatsapp_message_id,
        sender,
        body,
        message_type,
        direction,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (whatsapp_message_id)
      DO UPDATE SET
        sender = EXCLUDED.sender,
        body = EXCLUDED.body,
        message_type = EXCLUDED.message_type,
        direction = EXCLUDED.direction,
        raw_payload = EXCLUDED.raw_payload
      RETURNING *
    `,
    [
      whatsappMessageId,
      sender,
      body,
      messageType,
      direction,
      JSON.stringify(rawPayload)
    ]
  );

  return result.rows[0];
}

async function listMessages(limit = 100) {
  const result = await query(
    `
      SELECT *
      FROM messages
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

async function getMessagesBySender(sender, limit = 100) {
  const result = await query(
    `
      SELECT *
      FROM messages
      WHERE sender = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [sender, limit]
  );

  return result.rows;
}

async function getMessageByWhatsappId(whatsappMessageId) {
  const result = await query(
    `
      SELECT *
      FROM messages
      WHERE whatsapp_message_id = $1
      LIMIT 1
    `,
    [whatsappMessageId]
  );

  return result.rows[0] || null;
}

module.exports = {
  saveMessage,
  listMessages,
  getMessagesBySender,
  getMessageByWhatsappId
};
