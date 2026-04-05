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

const DEFAULT_RSS_FEEDS = [
  { label: 'NPR Economy',  url: 'https://feeds.npr.org/1017/rss.xml' },
  { label: 'Al Jazeera',   url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { label: 'BBC News',     url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { label: 'Euronews',     url: 'https://www.euronews.com/rss?level=theme&name=business' },
  { label: 'Reuters',      url: 'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en' },
];

// RSS_FEEDS パース: "ラベル|URL|ラベル|URL" → [{label, url}, ...]
function parseRssFeeds(raw) {
  if (!raw) return DEFAULT_RSS_FEEDS;
  const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length % 2 !== 0) {
    console.warn('RSS_FEEDS の形式が不正なためデフォルト設定を使用します。');
    return DEFAULT_RSS_FEEDS;
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
  rssFeeds:           parseRssFeeds(process.env.RSS_FEEDS || ''),
  articleMaxAgeHours: parseInt(optional('ARTICLE_MAX_AGE_HOURS', '24'), 10),
  maxArticlesPerSource: parseInt(optional('MAX_ARTICLES_PER_SOURCE', '5'), 10),
  claudeModel:        optional('CLAUDE_MODEL', 'claude-haiku-4-5'),
});

module.exports = config;
