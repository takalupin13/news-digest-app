'use strict';

require('dotenv').config();

function required(key) {
  const val = process.env[key];
  if (!val) throw new Error(`環境変数 ${key} が設定されていません。.env ファイルを確認してください。`);
  return val;
}

function optional(key, defaultValue) {
  return process.env[key] || defaultValue;
}

// RSS_FEEDS パース: "ラベル|URL|ラベル|URL" → [{label, url}, ...]
function parseRssFeeds(raw) {
  const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length % 2 !== 0) {
    throw new Error('RSS_FEEDS の形式が正しくありません。"ラベル|URL|ラベル|URL" の形式で指定してください。');
  }
  const feeds = [];
  for (let i = 0; i < parts.length; i += 2) {
    feeds.push({ label: parts[i], url: parts[i + 1] });
  }
  return feeds;
}

const config = Object.freeze({
  anthropicApiKey:    required('ANTHROPIC_API_KEY'),
  gmailUser:          required('GMAIL_USER'),
  gmailAppPassword:   required('GMAIL_APP_PASSWORD').replace(/\s/g, ''),
  emailFrom:          required('EMAIL_FROM'),
  emailTo:            required('EMAIL_TO').split(',').map(s => s.trim()).filter(Boolean),
  emailSubject:       optional('EMAIL_SUBJECT', '今日のニュースダイジェスト'),
  rssFeeds:           parseRssFeeds(required('RSS_FEEDS')),
  articleMaxAgeHours: parseInt(optional('ARTICLE_MAX_AGE_HOURS', '24'), 10),
  maxArticlesPerSource: parseInt(optional('MAX_ARTICLES_PER_SOURCE', '5'), 10),
  claudeModel:        optional('CLAUDE_MODEL', 'claude-haiku-4-5'),
});

module.exports = config;
