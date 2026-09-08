import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
// Auth sidecar store: participants, sessions, login codes, rate limits and anonymous-claim records.
// Separate SQLite file from the plan documents (same WAL/FULL discipline). Every ownership rule that must
// hold under concurrency is a database constraint, not application memory:
//   participants.avatar_id UNIQUE  → one owner per avatar (NULL allowed, many NULLs allowed)
//   one avatar_id column per row   → one avatar per account
//   claims UNIQUE(plan_id,anonymous_actor) / UNIQUE(plan_id,participant_id) → no double or cross-account claims
export class AuthStore{
 constructor(path){
  if(!path)throw new Error('An explicit durable auth store path is required.');
  if(path!==':memory:')mkdirSync(dirname(resolve(path)),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS participants(
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
 profile_revision INTEGER NOT NULL DEFAULT 0, onboarded INTEGER NOT NULL DEFAULT 0,
 name TEXT, avatar_id INTEGER UNIQUE, animal TEXT, age INTEGER, food TEXT, genre TEXT, film TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS login_codes(
 id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, client TEXT);
CREATE INDEX IF NOT EXISTS login_codes_email ON login_codes(email,created_at);
CREATE TABLE IF NOT EXISTS sessions(
 token_hash TEXT PRIMARY KEY, participant_id TEXT NOT NULL REFERENCES participants(id), created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, revoked_at TEXT, client TEXT);
CREATE INDEX IF NOT EXISTS sessions_participant ON sessions(participant_id);
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS claims(
 plan_id TEXT NOT NULL, anonymous_actor TEXT NOT NULL, participant_id TEXT NOT NULL REFERENCES participants(id),
 request_key TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT,
 PRIMARY KEY(plan_id,anonymous_actor), UNIQUE(plan_id,participant_id));
CREATE TABLE IF NOT EXISTS password_credentials(participant_id TEXT PRIMARY KEY REFERENCES participants(id), password_hash TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_ownership(participant_id TEXT PRIMARY KEY REFERENCES participants(id), verified_at TEXT);
CREATE TABLE IF NOT EXISTS session_security(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash), method TEXT NOT NULL, authenticated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_invites(token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL, participant_id TEXT REFERENCES participants(id), credential_revision INTEGER NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT);
CREATE TABLE IF NOT EXISTS receipts(scope TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(scope,request_key));`);
  const q=s=>this.db.prepare(s);
  this.q={
   participantById:q('SELECT * FROM participants WHERE id=?'),
   participantByEmail:q('SELECT * FROM participants WHERE email=?'),
   insertParticipant:q('INSERT INTO participants(id,email,created_at) VALUES(?,?,?)'),
   updateProfile:q('UPDATE participants SET name=?,avatar_id=?,animal=?,age=?,food=?,genre=?,film=?,onboarded=1,profile_revision=profile_revision+1,updated_at=? WHERE id=? AND profile_revision=?'),
   updateAvatar:q('UPDATE participants SET avatar_id=?,profile_revision=profile_revision+1,updated_at=? WHERE id=? AND profile_revision=? AND onboarded=1'),
   takenAvatars:q('SELECT id,avatar_id,name FROM participants WHERE avatar_id IS NOT NULL'),
   insertCode:q('INSERT INTO login_codes(id,email,code_hash,created_at,expires_at,client) VALUES(?,?,?,?,?,?)'),
   codeById:q('SELECT * FROM login_codes WHERE id=?'),
   bumpAttempts:q('UPDATE login_codes SET attempts=attempts+1 WHERE id=? RETURNING attempts'),
   consumeCode:q('UPDATE login_codes SET consumed_at=? WHERE id=? AND consumed_at IS NULL'),
   expireOpenCodes:q('UPDATE login_codes SET consumed_at=? WHERE email=? AND consumed_at IS NULL AND id<>?'),
   insertSession:q('INSERT INTO sessions(token_hash,participant_id,created_at,expires_at,last_seen_at,client) VALUES(?,?,?,?,?,?)'),
   sessionByHash:q('SELECT s.*,p.email,p.onboarded FROM sessions s JOIN participants p ON p.id=s.participant_id WHERE s.token_hash=?'),
   touchSession:q('UPDATE sessions SET last_seen_at=?,expires_at=? WHERE token_hash=?'),
   revokeSession:q('UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL'),
   revokeAllSessions:q('UPDATE sessions SET revoked_at=? WHERE participant_id=? AND revoked_at IS NULL'),
   rateGet:q('SELECT window_start,count FROM rate_limits WHERE key=?'),
   rateSet:q('INSERT INTO rate_limits(key,window_start,count) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=excluded.count'),
   claimGet:q('SELECT * FROM claims WHERE plan_id=? AND anonymous_actor=?'),
   claimByParticipant:q('SELECT * FROM claims WHERE plan_id=? AND participant_id=?'),
   claimInsert:q('INSERT INTO claims(plan_id,anonymous_actor,participant_id,request_key,status,created_at) VALUES(?,?,?,?,?,?)'),
   claimComplete:q('UPDATE claims SET status=?,completed_at=? WHERE plan_id=? AND anonymous_actor=?'),
   claimDelete:q('DELETE FROM claims WHERE plan_id=? AND anonymous_actor=? AND status=?'),
   claimTakeover:q('UPDATE claims SET participant_id=?,request_key=?,created_at=? WHERE plan_id=? AND anonymous_actor=? AND status=?'),
   receiptGet:q('SELECT fingerprint,result FROM receipts WHERE scope=? AND request_key=?'),
   receiptPut:q('INSERT INTO receipts(scope,request_key,fingerprint,result,created_at) VALUES(?,?,?,?,?)'),
   receiptCount:q('SELECT COUNT(*) AS n FROM receipts WHERE scope=?'),
  };
 }
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const out=fn();this.db.exec('COMMIT');return out}catch(e){this.db.exec('ROLLBACK');throw e}}
 // Fixed-window counter. Returns {allowed,retryAfterSeconds}. Windows are keyed by string, so callers scope them.
 rateLimit(key,limit,windowSeconds,nowMs){const start=Math.floor(nowMs/1000/windowSeconds)*windowSeconds;const row=this.q.rateGet.get(key);const count=row&&row.window_start===start?row.count:0;if(count>=limit)return {allowed:false,retryAfterSeconds:start+windowSeconds-Math.floor(nowMs/1000)};this.q.rateSet.run(key,start,count+1);return {allowed:true,retryAfterSeconds:0}}
 close(){this.db.close()}
}
export const isUniqueViolation=e=>/UNIQUE constraint failed/.test(e?.message||'');
