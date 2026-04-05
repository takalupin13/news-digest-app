'use strict';

const cheerio = require('cheerio');
const logger = require('./logger');

const FETCH_TIMEOUT_MS = 10000;
const MAX_CONTENT_CHARS = 4000;

// 記事本文として除外するセレクター（ナビ・広告・フッターなど）
const EXCLUDE_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '.ad', '.ads', '.advertisement', '.sponsored',
  '.nav', '.navigation', '.menu', '.sidebar',
  '.social', '.share', '.related', '.recommended',
  'script', 'style', 'noscript', 'iframe',
].join(', ');

// 記事本文が含まれやすいセレクター（優先順）
const CONTENT_SELECTORS = [
  'article',
  '[role="main"]',
  '.article-body',
  '.article__body',
  '.story-body',
  '.entry-content',
  '.post-content',
  '.article-content',
  'main',
];

/**
 * URLから記事本文テキストを取得する
 * @param {string} url
 * @returns {Promise<string>} 本文テキスト（取得失敗時は空文字列）
 */
async function fetchArticleText(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.debug(`スクレイプ失敗 (${res.status}): ${url}`);
      return '';
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 不要要素を削除
    $(EXCLUDE_SELECTORS).remove();

    // 記事本文を優先セレクターで探す
    let text = '';
    for (const sel of CONTENT_SELECTORS) {
      const el = $(sel).first();
      if (el.length) {
        text = el.find('p').map((_, p) => $(p).text().trim()).get().filter(Boolean).join('\n');
        if (text.length > 200) break;
      }
    }

    // 見つからなければ全<p>タグから取得
    if (text.length < 200) {
      text = $('p').map((_, p) => $(p).text().trim()).get().filter(s => s.length > 40).join('\n');
    }

    return text.slice(0, MAX_CONTENT_CHARS);
  } catch (err) {
    if (err.name !== 'AbortError') {
      logger.debug(`スクレイプエラー: ${url} — ${err.message}`);
    }
    return '';
  }
}

/**
 * 記事グループの全URLを並列スクレイプする
 * @param {Array<{label, articles}>} sourceGroups
 * @returns {Promise<Array<{label, articles}>>} 本文テキストを付加した記事グループ
 */
async function scrapeArticles(sourceGroups) {
  const results = [];

  for (const group of sourceGroups) {
    logger.info(`記事本文を取得中: ${group.label} (${group.articles.length} 件)...`);

    const scraped = await Promise.all(
      group.articles.map(async article => {
        const body = await fetchArticleText(article.link);
        if (body.length > 200) {
          logger.debug(`  本文取得OK: ${article.title.slice(0, 40)}...`);
        } else {
          logger.debug(`  本文取得NG（スニペット使用）: ${article.title.slice(0, 40)}...`);
        }
        return {
          ...article,
          // 本文が取得できた場合はそちらを優先、失敗時はRSSスニペット
          body: body.length > 200 ? body : article.snippet,
        };
      })
    );

    results.push({ label: group.label, articles: scraped });
  }

  return results;
}

module.exports = { scrapeArticles };
