'use strict';

require('dotenv').config();

const config     = require('./config');
const fetcher    = require('./fetcher');
const scraper    = require('./scraper');
const summarizer = require('./summarizer');
const mailer     = require('./mailer');
const db         = require('./db');
const logger     = require('./logger');

async function main() {
  logger.info('=== ニュースダイジェスト 開始 ===');

  // Step 1: RSSフィード取得
  logger.info(`RSSフィードを取得中 (${config.rssFeeds.length} ソース)...`);
  const sourceGroups = await fetcher.fetchAll(config);

  const totalArticles = sourceGroups.reduce((n, g) => n + g.articles.length, 0);
  if (totalArticles === 0) {
    logger.warn('記事が取得できませんでした。メール送信をスキップします。');
    process.exit(0);
  }
  logger.info(`合計 ${totalArticles} 件取得 (${sourceGroups.length} ソース)`);

  // Step 2: 記事本文をスクレイプ
  logger.info('記事本文を取得中...');
  const scrapedGroups = await scraper.scrapeArticles(sourceGroups);

  // Step 3: Claude APIで要約
  logger.info('Claude APIで要約中...');
  const summarizedSources = await summarizer.summarizeAll(scrapedGroups, config);
  logger.info('要約完了');

  // Step 4: データベースに保存
  logger.info('データベースに保存中...');
  let savedCount = 0;
  for (const sourceGroup of scrapedGroups) {
    const summaryGroup = summarizedSources.find(s => s.label === sourceGroup.label);
    for (const article of sourceGroup.articles) {
      const summaryItem = summaryGroup?.summaries.find(s => s.url === article.link || s.title === article.title);
      await db.saveArticle({
        source:  article.source,
        title:   article.title,
        url:     article.link,
        pubDate: article.pubDate,
        body:    article.body || article.snippet || '',
        summary: summaryItem?.summary || '',
      });
      savedCount++;
    }
  }
  const totalCount = await db.getArticleCount();
  logger.info(`${savedCount} 件をデータベースに保存 (累計: ${totalCount} 件)`);

  // Step 5: メール送信
  logger.info(`メール送信中 → ${config.emailTo.join(', ')}`);
  const info = await mailer.send(summarizedSources, config);
  logger.info(`メール送信完了 (messageId: ${info.messageId})`);

  logger.info('=== ニュースダイジェスト 完了 ===');
  process.exit(0);
}

main().catch(err => {
  require('./logger').error('致命的エラー:', err.message);
  if (process.env.LOG_LEVEL === 'debug') {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
});
