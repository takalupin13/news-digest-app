'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('./logger');

const SYSTEM_PROMPT = `あなたはアメリカ経済ニュースの専門アナリストです。
以下のニュース記事リストを読み、**アメリカ経済の動向に関連する記事のみ**を選んで日本語で要約してください。

対象とするトピック例：
- 米国の景気・GDP・雇用統計・インフレ・金利
- FRB（連邦準備制度）の金融政策・利上げ・利下げ
- 米国株式市場・ドル相場・国債
- 米国の貿易・関税・対中政策・サプライチェーン
- 米国企業の業績・決算・リストラ
- 米国の財政・予算・債務上限

【出力形式】
- 番号付きリスト（1. 2. 3. ...）で返してください
- アメリカ経済に無関係な記事は「1. （該当なし）」のように記載してください
- 各要約は日本語で2〜3文にまとめてください
- 重要なキーワードは太字マークダウン（**キーワード**）で示してください
- 必ず記事の番号と同じ順番で回答してください`;

function buildUserPrompt(sourceGroup) {
  const lines = [`以下は「${sourceGroup.label}」の本日のニュース記事です。各記事を番号順に要約してください。\n`];
  sourceGroup.articles.forEach((article, i) => {
    lines.push(`記事${i + 1}: ${article.title}`);
    // 本文が取得できていればそちらを優先、なければスニペット
    const content = article.body || article.snippet || '';
    if (content) {
      lines.push(`本文:\n${content}`);
    }
    lines.push(`URL: ${article.link}`);
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Claude APIのレスポンスから番号付きリストを解析する
 * @param {string} text
 * @param {number} count 期待する記事数
 * @returns {string[]}
 */
function parseSummaries(text, count) {
  const lines = text.split('\n');
  const summaries = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (match) {
      if (current !== null) summaries.push(current.trim());
      current = match[2];
    } else if (current !== null && line.trim()) {
      current += ' ' + line.trim();
    }
  }
  if (current !== null) summaries.push(current.trim());

  // 件数が合わない場合は空文字列で埋める
  while (summaries.length < count) summaries.push('');
  return summaries.slice(0, count);
}

/**
 * 1ソースグループをClaude APIで要約する
 */
async function summarizeSource(sourceGroup, client, model) {
  logger.info(`要約中: ${sourceGroup.label} (${sourceGroup.articles.length} 件)`);

  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(sourceGroup) }],
  });

  const rawText = message.content[0].text;
  const summaryTexts = parseSummaries(rawText, sourceGroup.articles.length);

  const summaries = sourceGroup.articles
    .map((article, i) => ({
      title: article.title,
      link: article.link,
      pubDate: article.pubDate,
      summary: summaryTexts[i] || article.title,
    }))
    .filter(item => !item.summary.includes('該当なし'));

  return { label: sourceGroup.label, summaries };
}

/**
 * 全ソースグループを順番に要約する（レート制限対策で逐次処理）
 * @param {Array} sourceGroups
 * @param {object} config
 * @returns {Promise<Array>}
 */
async function summarizeAll(sourceGroups, config) {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const results = [];

  for (const group of sourceGroups) {
    try {
      const result = await summarizeSource(group, client, config.claudeModel);
      results.push(result);
    } catch (err) {
      logger.warn(`${group.label}: 要約失敗 — ${err.message}`);
      // フォールバック: タイトルをそのまま使用
      results.push({
        label: group.label,
        summaries: group.articles.map(a => ({
          title: a.title,
          link: a.link,
          pubDate: a.pubDate,
          summary: a.title,
        })),
      });
    }
  }

  return results;
}

module.exports = { summarizeAll };
