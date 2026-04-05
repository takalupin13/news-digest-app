'use strict';

require('dotenv').config();

const express  = require('express');
const path     = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const db       = require('./db');
const config   = require('./config');
const logger   = require('./logger');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const SYSTEM_PROMPT = `あなたはアメリカ経済ニュースのアナリストです。
ユーザーの質問に対して、以下に提供する【参考記事】のみを根拠として回答してください。

回答のルール:
- 必ず【参考記事】に基づいた事実のみを述べてください
- 参考記事に情報がない場合は「その点についてはデータベース内の記事に情報がありません」と正直に答えてください
- 回答の末尾に、根拠にした記事のタイトルとURLを「【参考にした記事】」として列挙してください
- 回答は日本語で、わかりやすく簡潔にまとめてください`;

function buildContext(articles) {
  if (articles.length === 0) return '（関連記事が見つかりませんでした）';
  return articles.map((a, i) => {
    const date = a.pub_date ? new Date(a.pub_date).toLocaleDateString('ja-JP') : '日付不明';
    const content = (a.body || a.summary || '').slice(0, 1500);
    return `--- 記事${i + 1} ---\nタイトル: ${a.title}\nソース: ${a.source}\n日付: ${date}\nURL: ${a.url}\n本文:\n${content}`;
  }).join('\n\n');
}

// チャットエンドポイント
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'メッセージが空です' });

  try {
    // データベースから関連記事を検索
    let articles = await db.searchArticles(message, 8);
    if (articles.length === 0) {
      articles = await db.getRecentArticles(5);
    }

    const context = buildContext(articles);
    const systemWithContext = `${SYSTEM_PROMPT}\n\n【参考記事】\n${context}`;

    // 会話履歴を構築（最新10件まで）
    const messages = [
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const response = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 1024,
      system: systemWithContext,
      messages,
    });

    const reply = response.content[0].text;
    res.json({ reply, articlesFound: articles.length });
  } catch (err) {
    logger.error('チャットエラー:', err.message);
    res.status(500).json({ error: 'エラーが発生しました: ' + err.message });
  }
});

// データベース統計エンドポイント
app.get('/api/stats', async (req, res) => {
  try {
    const count = await db.getArticleCount();
    const recent = await db.getRecentArticles(5);
    res.json({ totalArticles: count, recentArticles: recent.map(a => ({ title: a.title, source: a.source, pub_date: a.pub_date })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  const count = await db.getArticleCount();
  logger.info(`チャットサーバー起動: http://localhost:${PORT}`);
  logger.info(`データベース内記事数: ${count} 件`);
});
