'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * 記事を保存する（URLが重複する場合はbody/summaryを更新）
 */
async function saveArticle({ source, title, url, pubDate, body, summary }) {
  const { error } = await supabase
    .from('articles')
    .upsert(
      {
        source,
        title,
        url,
        pub_date: pubDate ? pubDate.toISOString() : null,
        body: body || '',
        summary: summary || '',
      },
      { onConflict: 'url' }
    );

  if (error) throw new Error(`DB保存エラー: ${error.message}`);
}

/**
 * キーワードで記事を検索する
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function searchArticles(query, limit = 8) {
  const keyword = query.trim().split(/\s+/)[0]; // 最初の単語で検索

  const { data, error } = await supabase
    .from('articles')
    .select('id, source, title, url, pub_date, body, summary')
    .or(`title.ilike.%${keyword}%,body.ilike.%${keyword}%,summary.ilike.%${keyword}%`)
    .order('pub_date', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`DB検索エラー: ${error.message}`);
  return data || [];
}

/**
 * 最近の記事を取得する
 */
async function getRecentArticles(limit = 10) {
  const { data, error } = await supabase
    .from('articles')
    .select('id, source, title, url, pub_date, body, summary')
    .order('pub_date', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`DB取得エラー: ${error.message}`);
  return data || [];
}

/**
 * 保存済み記事の総件数
 */
async function getArticleCount() {
  const { count, error } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true });

  if (error) throw new Error(`DB件数取得エラー: ${error.message}`);
  return count || 0;
}

module.exports = { saveArticle, searchArticles, getRecentArticles, getArticleCount };
