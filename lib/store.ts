import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
export const json=(data:unknown,status=200,headers:HeadersInit={})=>Response.json(data,{status,headers});
const bytes=(n=24)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')};
export const staffRoles=['founder','admin','secretary','staff'] as const;
export type StaffRole=(typeof staffRoles)[number];
export const normalizedRole=(role:string)=>role==='creator'?'founder':role;
export const isStaff=(role:string)=>staffRoles.includes(normalizedRole(role) as StaffRole);
const roleRanks:Record<string,number>={member:0,staff:1,secretary:2,admin:3,founder:4};
export const roleRank=(role:string)=>roleRanks[normalizedRole(role)]??0;
export const canModerate=(actorRole:string,targetRole:string)=>isStaff(actorRole)&&roleRank(actorRole)>roleRank(targetRole);
export async function hash(password:string,salt:string){const raw=new TextEncoder().encode(salt+password);const out=await crypto.subtle.digest('SHA-256',raw);return [...new Uint8Array(out)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function setup(){await env.DB.batch([
 env.DB.prepare('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, avatar_key TEXT, role TEXT NOT NULL DEFAULT \'member\', banned INTEGER NOT NULL DEFAULT 0, account_status TEXT NOT NULL DEFAULT \'active\', suspended_until INTEGER, warnings_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, conversation_id INTEGER NOT NULL DEFAULT 1, edited_at INTEGER, deleted_at INTEGER, attachment_key TEXT, attachment_type TEXT, attachment_name TEXT, attachment_size INTEGER)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, created_by INTEGER NOT NULL, created_at INTEGER NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS conversation_members (conversation_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY(conversation_id,user_id))'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL, message_id INTEGER NOT NULL, reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'new\', created_at INTEGER NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS call_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, started_by INTEGER NOT NULL, mode TEXT NOT NULL DEFAULT \'audio\', started_at INTEGER NOT NULL, ended_at INTEGER)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS call_participants (call_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, left_at INTEGER, PRIMARY KEY(call_id,user_id))'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS call_signals (id INTEGER PRIMARY KEY AUTOINCREMENT, call_id INTEGER NOT NULL, from_user_id INTEGER NOT NULL, to_user_id INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS moderator_status (id INTEGER PRIMARY KEY CHECK(id=1), last_run_at INTEGER NOT NULL, checked_count INTEGER NOT NULL DEFAULT 0, removed_count INTEGER NOT NULL DEFAULT 0, banned_count INTEGER NOT NULL DEFAULT 0, summary TEXT NOT NULL DEFAULT \'\')')
])}
export async function me(){const jar=await cookies(),token=jar.get('cat_session_v2')?.value;if(!token)return null;const user=await env.DB.prepare('SELECT users.id,users.username,users.name,users.avatar_key AS avatarKey,users.role,users.banned,users.account_status AS accountStatus,users.suspended_until AS suspendedUntil FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires_at>?').bind(token,Date.now()).first<{id:number;username:string;name:string;avatarKey:string|null;role:string;banned:number;accountStatus:string;suspendedUntil:number|null}>();if(!user)return null;if(user.role==='creator'){await env.DB.prepare("UPDATE users SET role='founder' WHERE id=?").bind(user.id).run();user.role='founder'}if(user.accountStatus==='suspended'&&user.suspendedUntil&&user.suspendedUntil<=Date.now()){await env.DB.prepare("UPDATE users SET account_status='active',suspended_until=NULL WHERE id=?").bind(user.id).run();user.accountStatus='active';user.suspendedUntil=null}if(user.accountStatus!=='active'||user.banned)return null;return user}
export function session(token:string,remember=false){return `cat_session_v2=${token}; Path=/; HttpOnly; Secure; SameSite=Lax${remember?'; Max-Age=2592000':''}`}
export function clearSession(){return 'cat_session_v2=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}
export {bytes};
