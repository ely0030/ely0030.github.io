import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MOVIE_CATALOGUE = fileURLToPath(new URL('./.data/movie-catalogue.sqlite', import.meta.url));
const TRANSLITERATE = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd' };
export function normalizeMovieQuery(value) {
  return value.toLowerCase().replace(/[ßæœøłđ]/g, c => TRANSLITERATE[c])
    .normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

/** Open an existing local, personal-use IMDb index. Synchronous, read-only; no upstream calls. */
export function openMovieCatalogue(path = DEFAULT_MOVIE_CATALOGUE) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=1500; PRAGMA cache_size=-32768; PRAGMA mmap_size=268435456;');
    const metadata = Object.fromEntries(db.prepare('SELECT key,value FROM metadata').all().map(r => [r.key,r.value]));
    if (metadata.schemaVersion !== '1' || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.asOf)) {
      throw new Error('Unsupported or undated movie catalogue');
    }
    const byId = db.prepare('SELECT * FROM movies WHERE id = ?');
    const byTerms = db.prepare(`
      SELECT m.* FROM movie_search JOIN movies m ON m.rowid=movie_search.rowid
      WHERE movie_search MATCH ? AND (? IS NULL OR m.year = ?)
      ORDER BY CASE WHEN m.searchTitle = ? OR m.searchOriginal = ? OR m.searchTitle = ? OR m.searchOriginal = ? THEN 0
                    ELSE 1 END,
               m.votes DESC, m.rating DESC, length(m.title), m.year DESC, m.id
      LIMIT ?`);
    let closed = false;
    function result(row) {
      return row ? { id: row.id, title: row.title, originalTitle: row.originalTitle,
        year: row.year, runtime: row.runtime, genres: JSON.parse(row.genres),
        rating: row.rating, votes: row.votes, asOf: metadata.asOf } : null;
    }
    function assertOpen() { if (closed) throw new Error('Movie catalogue is closed'); }
    return {
      search(query, limit = 8) {
        assertOpen();
        if (typeof query !== 'string' || query.trim().length < 2 || query.length > 120) return [];
        const normalized = normalizeMovieQuery(query);
        if (normalized.length < 2) return [];
        let tokens = normalized.split(' '), year = null;
        if (tokens.length > 1 && /^(18|19|20|21)\d{2}$/.test(tokens.at(-1))) year = Number(tokens.pop());
        if (!tokens.length || tokens.length > 12) return [];
        const phrase = tokens.join(' ');
        // Literal normalized tokens are quoted individually; FTS operators supplied by visitors cannot execute.
        const match = tokens.map(token => `"${token}"*`).join(' AND ');
        const count = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(12, Math.trunc(Number(limit)))) : 8;
        return byTerms.all(match, year, year, phrase, phrase, `the ${phrase}`, `the ${phrase}`, count).map(result);
      },
      get(id) {
        assertOpen();
        if (typeof id !== 'string' || !/^tt\d{7,12}$/.test(id)) return null;
        return result(byId.get(id));
      },
      close() { if (!closed) { closed = true; db.close(); } }
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
