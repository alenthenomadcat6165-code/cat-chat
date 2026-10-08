import {env} from 'cloudflare:workers';
import {json,me} from '../../../lib/store';

async function isMember(userId:number,conversationId:number){
 return !!await env.DB.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').bind(conversationId,userId).first();
}

export async function GET(req:Request){
 const user=await me();
 if(!user)return json({error:'Open the site again.'},401);
 const conversationId=Number(new URL(req.url).searchParams.get('conversationId'));
 if(!conversationId||conversationId===1)return json({error:'Choose a group or private chat.'},400);
 if(!await isMember(user.id,conversationId))return json({error:'You are not in this chat.'},403);
 const chat=await env.DB.prepare('SELECT id,name,type,created_by AS createdBy,created_at AS createdAt FROM conversations WHERE id=?').bind(conversationId).first();
 if(!chat)return json({error:'Chat not found.'},404);
 const members=await env.DB.prepare(`SELECT users.id,users.name,users.avatar_key AS avatarKey,users.role FROM conversation_members JOIN users ON users.id=conversation_members.user_id WHERE conversation_members.conversation_id=? ORDER BY users.name COLLATE NOCASE`).bind(conversationId).all();
 return json({chat,members:members.results});
}

export async function POST(req:Request){
 const user=await me();
 if(!user)return json({error:'Open the site again.'},401);
 const b=await req.json() as {name?:string;type?:string;memberIds?:number[]};
 const ids=Array.from(new Set((b.memberIds??[]).map(Number).filter(x=>x>0&&x!==user.id))).slice(0,49);
 if(b.type==='private'&&ids.length!==1)return json({error:'Choose one person.'},400);
 if(b.type==='group'&&!ids.length)return json({error:'Choose at least one person.'},400);
 if(!['private','group'].includes(b.type??''))return json({error:'Choose a chat type.'},400);
 const name=b.type==='private'?'Private chat':(b.name??'').trim().slice(0,60);
 if(name.length<2)return json({error:'Add a group name.'},400);
 const r=await env.DB.prepare('INSERT INTO conversations(name,type,created_by,created_at) VALUES(?,?,?,?)').bind(name,b.type,user.id,Date.now()).run();
 const id=Number(r.meta.last_row_id);
 await env.DB.batch([user.id,...ids].map(uid=>env.DB.prepare('INSERT INTO conversation_members(conversation_id,user_id) VALUES(?,?)').bind(id,uid)));
 return json({chat:{id,name,type:b.type}});
}

export async function PATCH(req:Request){
 const user=await me();
 if(!user)return json({error:'Open the site again.'},401);
 const b=await req.json() as {conversationId?:number;memberIds?:number[]};
 const conversationId=Number(b.conversationId);
 if(!conversationId||conversationId===1)return json({error:'Everyone is already in the main school chat.'},400);
 if(!await isMember(user.id,conversationId))return json({error:'You are not in this chat.'},403);
 const chat=await env.DB.prepare('SELECT id,name,type FROM conversations WHERE id=?').bind(conversationId).first<{id:number;name:string;type:string}>();
 if(!chat)return json({error:'Chat not found.'},404);
 const requested=Array.from(new Set((b.memberIds??[]).map(Number).filter(x=>x>0&&x!==user.id))).slice(0,49);
 if(!requested.length)return json({error:'Choose at least one person.'},400);
 const placeholders=requested.map(()=>'?').join(',');
 const allowed=await env.DB.prepare(`SELECT id FROM users WHERE id IN (${placeholders}) AND banned=0 AND account_status='active'`).bind(...requested).all<{id:number}>();
 const activeIds=allowed.results.map(x=>x.id);
 if(!activeIds.length)return json({error:'Those accounts are not available.'},400);
 const existing=await env.DB.prepare(`SELECT user_id AS userId FROM conversation_members WHERE conversation_id=? AND user_id IN (${activeIds.map(()=>'?').join(',')})`).bind(conversationId,...activeIds).all<{userId:number}>();
 const existingIds=new Set(existing.results.map(x=>x.userId));
 const newIds=activeIds.filter(id=>!existingIds.has(id));
 if(!newIds.length)return json({error:'Everyone you selected is already in this chat.'},409);
 const nextType=chat.type==='private'?'group':chat.type;
 const nextName=chat.type==='private'&&chat.name==='Private chat'?'New Group Chat':chat.name;
 const statements=newIds.map(uid=>env.DB.prepare('INSERT OR IGNORE INTO conversation_members(conversation_id,user_id) VALUES(?,?)').bind(conversationId,uid));
 if(nextType!==chat.type)statements.push(env.DB.prepare('UPDATE conversations SET type=?,name=? WHERE id=?').bind(nextType,nextName,conversationId));
 await env.DB.batch(statements);
 return json({ok:true,added:newIds.length,chat:{id:conversationId,name:nextName,type:nextType}});
}
