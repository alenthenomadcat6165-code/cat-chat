import {env} from 'cloudflare:workers';
import {canModerate,isStaff,json,me,normalizedRole,roleRank,setup} from '../../../lib/store';

type Action='role'|'warn'|'suspend'|'pause'|'ban'|'restore';

export async function GET(){
 await setup();
 const actor=await me();
 if(!actor||!isStaff(actor.role))return json({error:'Staff access only.'},403);
 const users=await env.DB.prepare(`SELECT id,username,name,avatar_key AS avatarKey,role,account_status AS accountStatus,suspended_until AS suspendedUntil,warnings_count AS warningsCount,created_at AS createdAt FROM users ORDER BY CASE role WHEN 'founder' THEN 0 WHEN 'admin' THEN 1 WHEN 'secretary' THEN 2 WHEN 'staff' THEN 3 ELSE 4 END,name COLLATE NOCASE`).all();
 return json({me:{id:actor.id,role:normalizedRole(actor.role)},users:users.results});
}

export async function PATCH(req:Request){
 await setup();
 const actor=await me();
 if(!actor||!isStaff(actor.role))return json({error:'Staff access only.'},403);
 const body=await req.json() as {userId?:number;action?:Action;role?:string;reason?:string;days?:number};
 const userId=Number(body.userId),action=body.action;
 if(!userId||!action)return json({error:'Choose a person and an action.'},400);
 if(userId===actor.id)return json({error:'You cannot moderate your own account.'},400);
 const target=await env.DB.prepare('SELECT id,name,role,account_status AS accountStatus FROM users WHERE id=?').bind(userId).first<{id:number;name:string;role:string;accountStatus:string}>();
 if(!target)return json({error:'Account not found.'},404);
 const actorRole=normalizedRole(actor.role),targetRole=normalizedRole(target.role),now=Date.now();

 if(action==='role'){
  if(actorRole!=='founder')return json({error:'Only the founder can choose staff roles.'},403);
  const next=body.role??'';
  if(!['member','admin','secretary','staff'].includes(next))return json({error:'Choose a valid role.'},400);
  if(targetRole==='founder')return json({error:'The founder role is protected.'},403);
  await env.DB.batch([
   env.DB.prepare('UPDATE users SET role=? WHERE id=?').bind(next,userId),
   env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(actor.id,userId,'change_role',next,now)
  ]);
  return json({ok:true,message:`${target.name} is now ${next==='member'?'a member':next}.`});
 }

 if(!canModerate(actorRole,targetRole))return json({error:'You can only moderate accounts below your staff level.'},403);
 const reason=(body.reason??'').trim().slice(0,500);
 if(action==='warn'){
  if(!reason)return json({error:'Write a reason for the warning.'},400);
  await env.DB.batch([
   env.DB.prepare('INSERT INTO warnings(user_id,issued_by,message,created_at) VALUES(?,?,?,?)').bind(userId,actor.id,reason,now),
   env.DB.prepare('UPDATE users SET warnings_count=warnings_count+1 WHERE id=?').bind(userId),
   env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(actor.id,userId,'warning',reason,now)
  ]);
  return json({ok:true,message:`Warning sent to ${target.name}.`});
 }
 if(action==='suspend'){
  if(target.accountStatus!=='active')return json({error:'An admin must restore this account before it can be suspended.'},409);
  const days=Math.floor(Number(body.days));
  const maximum=actorRole==='staff'?3:actorRole==='secretary'?7:365;
  if(!days||days<1||days>maximum)return json({error:`Choose between 1 and ${maximum} days.`},400);
  const until=now+days*86400000;
  await env.DB.batch([
   env.DB.prepare("UPDATE users SET account_status='suspended',suspended_until=?,banned=0 WHERE id=?").bind(until,userId),
   env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
   env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(actor.id,userId,'suspend',`${days} day(s)${reason?`: ${reason}`:''}`,now)
  ]);
  return json({ok:true,message:`${target.name} is suspended for ${days} day${days===1?'':'s'}.`});
 }
 if(action==='pause'){
  if(roleRank(actorRole)<2)return json({error:'Staff/Orderly cannot pause accounts.'},403);
  if(target.accountStatus==='banned')return json({error:'Restore the banned account before changing its status.'},409);
  await env.DB.batch([
   env.DB.prepare("UPDATE users SET account_status='paused',suspended_until=NULL,banned=0 WHERE id=?").bind(userId),
   env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
   env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(actor.id,userId,'pause',reason,now)
  ]);
  return json({ok:true,message:`${target.name} is paused.`});
 }
 if(action==='ban'){
  if(roleRank(actorRole)<3)return json({error:'Only admins can ban accounts.'},403);
  await env.DB.batch([
   env.DB.prepare("UPDATE users SET account_status='banned',suspended_until=NULL,banned=1 WHERE id=?").bind(userId),
   env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
   env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(actor.id,userId,'ban',reason,now)
  ]);
  return json({ok:true,message:`${target.name} is banned.`});
 }
 if(action==='restore'){
  if(roleRank(actorRole)<3)return json({error:'Only admins can restore accounts.'},403);
  await env.DB.batch([
   env.DB.prepare("UPDATE users SET account_status='active',suspended_until=NULL,banned=0 WHERE id=?").bind(userId),
   env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(actor.id,userId,'restore','',now)
  ]);
  return json({ok:true,message:`${target.name}'s account is active again.`});
 }
 return json({error:'That action is not available.'},400);
}
