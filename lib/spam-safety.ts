import {env} from 'cloudflare:workers';
import {normalizedRole} from './store';

type MessageUser={id:number;role:string};
type SpamResult={spam:false}|{spam:true;reason:string};

function normalizedText(value:string){
 return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{Emoji_Presentation}]+/gu,' ').trim().replace(/\s+/g,' ');
}

export function checkInlineSpam(text:string):SpamResult{
 const normalized=normalizedText(text);
 if(!normalized)return {spam:false};
 const tokens=normalized.match(/[\p{L}\p{N}]+/gu)??[];
 if(tokens.length>=8){
  const counts=new Map<string,number>();
  for(const token of tokens)counts.set(token,(counts.get(token)??0)+1);
  const most=Math.max(...counts.values());
  if(most>=6&&most/tokens.length>=.5)return {spam:true,reason:'the same word was repeated too many times in one message'};
  if(tokens.length>=12&&counts.size<=2)return {spam:true,reason:'the same small group of words was repeated too many times'};
 }
 const compact=Array.from(normalized.replace(/\s/g,''));
 let run=1;
 for(let index=1;index<compact.length;index++){
  run=compact[index]===compact[index-1]?run+1:1;
  if(run>=12)return {spam:true,reason:'one character was repeated too many times'};
 }
 const compactText=compact.join('');
 for(let size=2;size<=5;size++){
  if(compactText.length>=size*7&&compactText.length%size===0){
   const part=compactText.slice(0,size);
   if(part.repeat(compactText.length/size)===compactText)return {spam:true,reason:'the same short phrase was repeated too many times'};
  }
 }
 return {spam:false};
}

export async function checkSpam(userId:number,text:string):Promise<SpamResult>{
 const inline=checkInlineSpam(text);
 if(inline.spam)return inline;
 const now=Date.now();
 const rows=await env.DB.prepare('SELECT body,created_at AS createdAt FROM messages WHERE user_id=? AND created_at>? ORDER BY created_at DESC LIMIT 12').bind(userId,now-120000).all<{body:string;createdAt:number}>();
 const recent=rows.results;
 if(recent.filter(row=>row.createdAt>now-15000).length>=7)return {spam:true,reason:'too many messages were sent too quickly'};
 const value=normalizedText(text);
 if(value&&recent.filter(row=>normalizedText(row.body)===value).length>=2)return {spam:true,reason:'the same message was repeatedly resent'};
 const sequence=[value,...recent.slice(0,6).map(row=>normalizedText(row.body))].filter(Boolean);
 if(sequence.length>=7&&new Set(sequence).size<=2)return {spam:true,reason:'the same messages were repeatedly resent'};
 return {spam:false};
}

export async function permanentlyBanForSpam(user:MessageUser,reason:string){
 if(normalizedRole(user.role)==='founder')return false;
 const now=Date.now();
 await env.DB.batch([
  env.DB.prepare("UPDATE users SET account_status='banned',banned=1,suspended_until=NULL WHERE id=?").bind(user.id),
  env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),
  env.DB.prepare('DELETE FROM typing_presence WHERE user_id=?').bind(user.id),
  env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(user.id,user.id,'automatic_spam_ban',reason,now)
 ]);
 return true;
}
