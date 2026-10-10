import {env} from 'cloudflare:workers';
import {isStaff,json,me} from '../../../lib/store';
import {canManageProtectedChat,deleteStoredFiles,ensureProtectedChats,isProtectedChat} from '../../../lib/protected-chats';

async function isMember(userId:number,conversationId:number){
 return !!await env.DB.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').bind(conversationId,userId).first();
}

export async function GET(req:Request){
 const user=await me();
 if(!user)return json({error:'Open the site again.'},401);
 await ensureProtectedChats();
 const conversationId=Number(new URL(req.url).searchParams.get('conversationId'));
 if(!conversationId||conversationId===1)return json({error:'Choose a group or private chat.'},400);
 if(!await isMember(user.id,conversationId))return json({error:'You are not in this chat.'},403);
 const chat=await env.DB.prepare('SELECT id,name,type,created_by AS createdBy,created_at AS createdAt FROM conversations WHERE id=?').bind(conversationId).first<{id:number;name:string;type:string;createdBy:number;createdAt:number}>();
 if(!chat)return json({error:'Chat not found.'},404);
 const members=await env.DB.prepare(`SELECT users.id,users.name,users.avatar_key AS avatarKey,users.role FROM conversation_members JOIN users ON users.id=conversation_members.user_id WHERE conversation_members.conversation_id=? AND users.banned=0 AND users.account_status!='banned' ORDER BY users.name COLLATE NOCASE`).bind(conversationId).all();
 const protectedChat=isProtectedChat(chat.type),founderCanManage=canManageProtectedChat(user.role);
 return json({chat:{...chat,protected:protectedChat},members:members.results,meId:user.id,canAddMembers:protectedChat?founderCanManage:true,canManageMembers:protectedChat?founderCanManage:chat.createdBy===user.id||isStaff(user.role)});
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
 if(['admin center','all staff center'].includes(name.toLowerCase()))return json({error:'That name is reserved for a protected center.'},409);
 const r=await env.DB.prepare('INSERT INTO conversations(name,type,created_by,created_at) VALUES(?,?,?,?)').bind(name,b.type,user.id,Date.now()).run();
 const id=Number(r.meta.last_row_id);
 await env.DB.batch([user.id,...ids].map(uid=>env.DB.prepare('INSERT INTO conversation_members(conversation_id,user_id) VALUES(?,?)').bind(id,uid)));
 return json({chat:{id,name,type:b.type}});
}

export async function PATCH(req:Request){
 const user=await me();
 if(!user)return json({error:'Open the site again.'},401);
 const b=await req.json() as {conversationId?:number;memberIds?:number[];action?:'add'|'remove'};
 const conversationId=Number(b.conversationId);
 if(!conversationId||conversationId===1)return json({error:'Everyone is already in the main school chat.'},400);
 if(!await isMember(user.id,conversationId))return json({error:'You are not in this chat.'},403);
 const chat=await env.DB.prepare('SELECT id,name,type,created_by AS createdBy FROM conversations WHERE id=?').bind(conversationId).first<{id:number;name:string;type:string;createdBy:number}>();
 if(!chat)return json({error:'Chat not found.'},404);
 const protectedChat=isProtectedChat(chat.type);
 if(protectedChat&&!canManageProtectedChat(user.role))return json({error:'Only the founder can change people in this protected center.'},403);
 const requested=Array.from(new Set((b.memberIds??[]).map(Number).filter(x=>x>0&&x!==user.id))).slice(0,49);
 if(!requested.length)return json({error:'Choose at least one person.'},400);
 if(b.action==='remove'){
  if(chat.createdBy!==user.id&&!isStaff(user.role))return json({error:'Only the chat creator or staff can remove people.'},403);
  const existing=await env.DB.prepare(`SELECT user_id AS userId FROM conversation_members WHERE conversation_id=? AND user_id IN (${requested.map(()=>'?').join(',')})`).bind(conversationId,...requested).all<{userId:number}>();
  const removeIds=existing.results.map(row=>row.userId);
  if(!removeIds.length)return json({error:'Those people are not in this chat.'},404);
  await env.DB.batch(removeIds.flatMap(id=>[
   env.DB.prepare('DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?').bind(conversationId,id),
   env.DB.prepare('DELETE FROM typing_presence WHERE conversation_id=? AND user_id=?').bind(conversationId,id)
  ]));
  return json({ok:true,removed:removeIds.length,chat:{id:conversationId,name:chat.name,type:chat.type}});
 }
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

export async function DELETE(req:Request){
 const user=await me();
 if(!user)return json({error:'Sign in first.'},401);
 const body=await req.json() as {conversationId?:number};
 const conversationId=Number(body.conversationId);
 if(!conversationId||conversationId===1)return json({error:'The Main School Chat cannot be deleted.'},400);
 const chat=await env.DB.prepare('SELECT id,name,type,created_by AS createdBy FROM conversations WHERE id=?').bind(conversationId).first<{id:number;name:string;type:string;createdBy:number}>();
 if(!chat)return json({error:'Chat not found.'},404);
 if(isProtectedChat(chat.type))return json({error:'Protected centers can never be deleted.'},403);
 if(chat.type!=='group')return json({error:'Only group chats can be deleted.'},400);
 if(chat.createdBy!==user.id)return json({error:'Only the person who created this group can delete it.'},403);
 const attachments=await env.DB.prepare('SELECT attachment_key AS attachmentKey FROM messages WHERE conversation_id=? AND attachment_key IS NOT NULL').bind(conversationId).all<{attachmentKey:string}>();
 await env.DB.batch([
  env.DB.prepare('DELETE FROM reports WHERE message_id IN (SELECT id FROM messages WHERE conversation_id=?)').bind(conversationId),
  env.DB.prepare('DELETE FROM call_signals WHERE call_id IN (SELECT id FROM call_sessions WHERE conversation_id=?)').bind(conversationId),
  env.DB.prepare('DELETE FROM call_participants WHERE call_id IN (SELECT id FROM call_sessions WHERE conversation_id=?)').bind(conversationId),
  env.DB.prepare('DELETE FROM call_sessions WHERE conversation_id=?').bind(conversationId),
  env.DB.prepare('DELETE FROM typing_presence WHERE conversation_id=?').bind(conversationId),
  env.DB.prepare('DELETE FROM messages WHERE conversation_id=?').bind(conversationId),
  env.DB.prepare('DELETE FROM conversation_members WHERE conversation_id=?').bind(conversationId),
  env.DB.prepare("DELETE FROM conversations WHERE id=? AND type='group' AND created_by=?").bind(conversationId,user.id)
 ]);
 await deleteStoredFiles(attachments.results.map(item=>item.attachmentKey)).catch(()=>{});
 return json({ok:true,message:`${chat.name} was deleted.`});
}
