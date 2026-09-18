import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
export const json=(data:unknown,status=200,headers:HeadersInit={})=>Response.json(data,{status,headers});
const bytes=(n=24)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')};
export async function hash(password:string,salt:string){const raw=new TextEncoder().encode(salt+password);const out=await crypto.subtle.digest('SHA-256',raw);return [...new Uint8Array(out)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function setup(){await env.DB.batch([
 env.DB.prepare('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, avatar_key TEXT, role TEXT NOT NULL DEFAULT \'member\', banned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, conversation_id INTEGER NOT NULL DEFAULT 1)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, created_by INTEGER NOT NULL, created_at INTEGER NOT NULL)'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS conversation_members (conversation_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY(conversation_id,user_id))'),
 env.DB.prepare('CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL, message_id INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL)')
])}
export async function me(){const jar=await cookies(),token=jar.get('cat_session_v2')?.value;if(!token)return null;return env.DB.prepare('SELECT users.id,users.username,users.name,users.avatar_key AS avatarKey,users.role,users.banned FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires_at>?').bind(token,Date.now()).first<{id:number;username:string;name:string;avatarKey:string|null;role:string;banned:number}>()}
export function session(token:string,remember=false){return `cat_session_v2=${token}; Path=/; HttpOnly; Secure; SameSite=Lax${remember?'; Max-Age=2592000':''}`}
export function clearSession(){return 'cat_session_v2=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}
export {bytes};
