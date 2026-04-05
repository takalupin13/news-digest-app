'use strict';

const Parser = require('rss-parser');
const logger = require('./logger');

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'NewsDigest/1.0 (personal RSS reader)' },
  customFields: {
    item: ['description', 'content:encoded'],
  },
});

/**
 * 1つのRSSフィードを取得して記事を正規化する
 * @param {{label: string, url: string}} feed
 * @param {number} maxAgeHours
 * @param {number} maxArticles
 * @returns {Promise<{label: string, articles: Array}>}
 */
async function fetchFeed(feed, maxAgeHours, maxArticles) {
  logger.info(`フィード取得中: ${feed.label} (${feed.url})`);
  const cutoff = Date.now() - maxAgeHours * 3600 * 1000;

  const parsed = await parser.parseURL(feed.url);

  const articles = parsed.items
    .filter(item => {
      const date = item.isoDate ? new Date(item.isoDate).getTime() : Date.now();
      return date >= cutoff;
    })
    .slice(0, maxArticles)
    .map(item => ({
      source: feed.label,
      title: (item.title || '').trim(),
      link: item.link || '',
      pubDate: item.isoDate ? new Date(item.isoDate) : new Date(),
      snippet: (item.contentSnippet || item.description || '').trim().slice(0, 300),
    }));

  logger.info(`  → ${articles.length} 件取得 (${feed.label})`);
  return { label: feed.label, articles };
}

/**
 * 全RSSフィードを並列取得する
 * @param {object} config
 * @returns {Promise<Array<{label: string, articles: Array}>>}
 */
async function fetchAll(config) {
  const results = await Promise.allSettled(
    config.rssFeeds.map(feed =>
      fetchFeed(feed, config.articleMaxAgeHours, config.maxArticlesPerSource)
    )
  );

  const sourceGroups = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const feed = config.rssFeeds[i];
    if (result.status === 'fulfilled') {
      if (result.value.articles.length > 0) {
        sourceGroups.push(result.value);
      } else {
        logger.warn(`${feed.label}: 直近 ${config.articleMaxAgeHours} 時間以内の記事がありません`);
      }
    } else {
      logger.warn(`${feed.label}: 取得失敗 — ${result.reason.message}`);
    }
  }

  return sourceGroups;
}

module.exports = { fetchAll };
