import {env} from 'cloudflare:workers';
import {normalizedRole} from './store';

export const ADMIN_CENTER_TYPE='admin_center';
export const STAFF_CENTER_TYPE='staff_center';
export const protectedChatTypes=[ADMIN_CENTER_TYPE,STAFF_CENTER_TYPE] as const;

type ProtectedChat={id:number;name:string;type:string;createdBy:number};

export function isProtectedChat(type:string){
 return protectedChatTypes.includes(type as (typeof protectedChatTypes)[number]);
}

export async function ensureProtectedChats(){
 const founder=await env.DB.prepare("SELECT id FROM users WHERE role IN ('founder','creator') AND banned=0 ORDER BY CASE role WHEN 'founder' THEN 0 ELSE 1 END,id LIMIT 1").first<{id:number}>();
 if(!founder)return [] as ProtectedChat[];
 const now=Date.now();
 for(const [name,type] of [['Admin Center',ADMIN_CENTER_TYPE],['All Staff Center',STAFF_CENTER_TYPE]] as const){
  await env.DB.prepare('INSERT INTO conversations(name,type,created_by,created_at) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM conversations WHERE type=?)').bind(name,type,founder.id,now,type).run();
 }
 const chats=await env.DB.prepare(`SELECT id,name,type,created_by AS createdBy FROM conversations WHERE type IN ('${ADMIN_CENTER_TYPE}','${STAFF_CENTER_TYPE}') ORDER BY CASE type WHEN '${ADMIN_CENTER_TYPE}' THEN 0 ELSE 1 END`).all<ProtectedChat>();
 if(chats.results.length)await env.DB.batch(chats.results.map(chat=>env.DB.prepare('INSERT OR IGNORE INTO conversation_members(conversation_id,user_id) VALUES(?,?)').bind(chat.id,founder.id)));
 return chats.results;
}

export function canManageProtectedChat(role:string){
 return normalizedRole(role)==='founder';
}

export async function deleteStoredFiles(keys:string[]){
 const unique=Array.from(new Set(keys.filter(Boolean)));
 for(let index=0;index<unique.length;index+=500)await env.FILES.delete(unique.slice(index,index+500));
}
