'use strict';

const nodemailer = require('nodemailer');

/**
 * 日付を日本語フォーマットに変換
 */
function formatDateJa(date) {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
}

function formatTimeJa(date) {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

/**
 * HTMLメール本文を生成する
 */
function buildHtmlEmail(summarizedSources) {
  const today = formatDateJa(new Date());
  const totalCount = summarizedSources.reduce((n, s) => n + s.summaries.length, 0);

  const sourceSections = summarizedSources.map(source => {
    const rows = source.summaries.map(item => `
      <tr>
        <td style="padding: 14px 0; border-bottom: 1px solid #eee; vertical-align: top;">
          <div style="margin-bottom: 6px;">
            <a href="${item.link}" style="color: #1a73e8; text-decoration: none; font-weight: bold; font-size: 14px;">${escapeHtml(item.title)}</a>
            <span style="color: #999; font-size: 12px; margin-left: 8px;">${formatTimeJa(item.pubDate)}</span>
          </div>
          <div style="color: #444; font-size: 13px; line-height: 1.7;">${markdownBold(escapeHtml(item.summary))}</div>
        </td>
      </tr>`).join('');

    return `
    <div style="margin-bottom: 32px;">
      <h2 style="color: #1a1a1a; font-size: 16px; border-left: 4px solid #1a73e8; padding-left: 10px; margin: 0 0 12px 0;">${escapeHtml(source.label)}</h2>
      <table style="width: 100%; border-collapse: collapse;">${rows}</table>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ニュースダイジェスト</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a73e8; padding: 24px 32px;">
              <div style="color: #ffffff; font-size: 20px; font-weight: bold;">今日のニュースダイジェスト</div>
              <div style="color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 4px;">${today} — ${totalCount} 件</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 24px 32px;">
              ${sourceSections}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 16px 32px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 11px; margin: 0; text-align: center;">このメールは News Digest が自動送信しました。</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * プレーンテキストメール本文を生成する（HTMLが表示できないクライアント向け）
 */
function buildPlaintextEmail(summarizedSources) {
  const today = formatDateJa(new Date());
  const lines = [`今日のニュースダイジェスト — ${today}\n`, '='.repeat(50)];

  for (const source of summarizedSources) {
    lines.push(`\n■ ${source.label}\n`);
    for (const item of source.summaries) {
      lines.push(`【${item.title}】`);
      lines.push(`${item.summary}`);
      lines.push(`${item.link}`);
      lines.push(`公開時刻: ${formatTimeJa(item.pubDate)}`);
      lines.push('');
    }
  }

  lines.push('\n' + '-'.repeat(50));
  lines.push('このメールは News Digest が自動送信しました。');
  return lines.join('\n');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// **text** → <strong>text</strong>
function markdownBold(str) {
  return str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * メールを送信する
 * @param {Array} summarizedSources
 * @param {object} config
 * @returns {Promise<object>} nodemailer info object
 */
async function send(summarizedSources, config) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: config.gmailUser,
      pass: config.gmailAppPassword,
    },
  });

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  });

  const info = await transporter.sendMail({
    from: config.emailFrom,
    to: config.emailTo.join(', '),
    subject: `${config.emailSubject} (${today})`,
    html: buildHtmlEmail(summarizedSources),
    text: buildPlaintextEmail(summarizedSources),
  });

  return info;
}

module.exports = { send };
