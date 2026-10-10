import {env} from 'cloudflare:workers';
import {checkMessageSafety,SafetyCategory} from './content-safety';
import {checkInlineSpam,normalizedSpamText,permanentlyBanForSpam} from './spam-safety';
import {setup} from './store';

type MessageRow={id:number;userId:number;body:string;createdAt:number;role:string};
type Flag={category:SafetyCategory|'spam';reason:string};
export type ModeratorStatus={lastRunAt:number;checkedCount:number;removedCount:number;bannedCount:number;summary:string};
export type ModeratorResult=ModeratorStatus&{skipped:boolean};

const cooldown=4*60*1000;
const firstRunLookback=15*60*1000;
const spamContext=2*60*1000;

async function readModeratorStatus(){
 return env.DB.prepare('SELECT last_run_at AS lastRunAt,checked_count AS checkedCount,removed_count AS removedCount,banned_count AS bannedCount,summary FROM moderator_status WHERE id=1').first<ModeratorStatus>();
}

export async function getModeratorStatus():Promise<ModeratorStatus|null>{
 await setup();
 return readModeratorStatus();
}

export async function runModeratorSweep():Promise<ModeratorResult>{
 await setup();
 const now=Date.now(),previous=await readModeratorStatus();
 if(previous&&now-previous.lastRunAt<cooldown)return {...previous,skipped:true};
 const reviewStart=previous?.lastRunAt??now-firstRunLookback;
 const query=await env.DB.prepare(`SELECT messages.id,messages.user_id AS userId,messages.body,messages.created_at AS createdAt,users.role FROM messages JOIN users ON users.id=messages.user_id WHERE messages.deleted_at IS NULL AND TRIM(messages.body)!='' AND messages.created_at>=? ORDER BY messages.id DESC LIMIT 1000`).bind(reviewStart-spamContext).all<MessageRow>();
 const messages=query.results.reverse(),reviewed=messages.filter(message=>message.createdAt>=reviewStart),reviewedIds=new Set(reviewed.map(message=>message.id)),flags=new Map<number,Flag>(),spamUsers=new Map<number,{role:string;reason:string}>();

 for(const message of reviewed){
  const safety=checkMessageSafety(message.body);
  if(!safety.allowed)flags.set(message.id,{category:safety.category,reason:safety.message});
  const inline=checkInlineSpam(message.body);
  if(inline.spam){flags.set(message.id,{category:'spam',reason:inline.reason});spamUsers.set(message.userId,{role:message.role,reason:inline.reason})}
 }

 const byUser=new Map<number,MessageRow[]>();
 for(const message of messages){const group=byUser.get(message.userId)??[];group.push(message);byUser.set(message.userId,group)}
 for(const [userId,group] of byUser){
  for(let start=0,end=0;end<group.length;end++){
   while(group[end].createdAt-group[start].createdAt>15000)start++;
   if(end-start+1>=8){const reason='too many messages were sent too quickly';for(let index=start;index<=end;index++)if(reviewedIds.has(group[index].id))flags.set(group[index].id,{category:'spam',reason});spamUsers.set(userId,{role:group[end].role,reason})}
  }
  const repeats=new Map<string,MessageRow[]>();
  for(const message of group){
   const value=normalizedSpamText(message.body);if(!value)continue;
   const recent=(repeats.get(value)??[]).filter(item=>message.createdAt-item.createdAt<=120000);recent.push(message);repeats.set(value,recent);
   if(recent.length>=3&&recent.some(item=>reviewedIds.has(item.id))){const reason='the same message was repeatedly resent';for(const item of recent)if(reviewedIds.has(item.id))flags.set(item.id,{category:'spam',reason});spamUsers.set(userId,{role:message.role,reason})}
  }
 }

 let bannedCount=0;
 for(const [userId,item] of spamUsers)if(await permanentlyBanForSpam({id:userId,role:item.role},item.reason))bannedCount++;
 const flaggedMessages=reviewed.filter(message=>flags.has(message.id)),removedCount=flaggedMessages.length;
 const founder=await env.DB.prepare("SELECT id FROM users WHERE role IN ('founder','creator') ORDER BY CASE role WHEN 'founder' THEN 0 ELSE 1 END,id LIMIT 1").first<{id:number}>();
 if(removedCount){
  const flaggedIds=flaggedMessages.map(message=>message.id),affected=new Map<number,Set<string>>();
  for(const message of flaggedMessages){const category=flags.get(message.id)!.category,set=affected.get(message.userId)??new Set<string>();set.add(category);affected.set(message.userId,set)}
  for(let index=0;index<flaggedIds.length;index+=75){const ids=flaggedIds.slice(index,index+75);await env.DB.prepare(`UPDATE messages SET deleted_at=? WHERE id IN (${ids.map(()=>'?').join(',')}) AND deleted_at IS NULL`).bind(now,...ids).run()}
  const actions=[];
  for(const [userId,categories] of affected){
   const actorId=founder?.id??userId,summary=`Automatic moderator removed message content for: ${[...categories].join(', ')}.`;
   actions.push(env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(actorId,userId,'automatic_moderator',summary,now));
   if(!spamUsers.has(userId)){actions.push(env.DB.prepare('INSERT INTO warnings(user_id,issued_by,message,created_at) VALUES(?,?,?,?)').bind(userId,actorId,'The automatic moderator removed a message that broke the Cat Chat safety rules.',now));actions.push(env.DB.prepare('UPDATE users SET warnings_count=warnings_count+1 WHERE id=?').bind(userId))}
  }
  for(let index=0;index<actions.length;index+=50)await env.DB.batch(actions.slice(index,index+50));
 }
 const categories=new Set([...flags.values()].map(flag=>flag.category)),summary=removedCount?`Removed ${removedCount} unsafe message${removedCount===1?'':'s'}${categories.size?` (${[...categories].join(', ')})`:''}.`:'No unsafe messages found.';
 await env.DB.prepare(`INSERT INTO moderator_status(id,last_run_at,checked_count,removed_count,banned_count,summary) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_run_at=excluded.last_run_at,checked_count=excluded.checked_count,removed_count=excluded.removed_count,banned_count=excluded.banned_count,summary=excluded.summary`).bind(now,reviewed.length,removedCount,bannedCount,summary).run();
 return {lastRunAt:now,checkedCount:reviewed.length,removedCount,bannedCount,summary,skipped:false};
}
