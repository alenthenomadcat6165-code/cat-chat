import {env} from 'cloudflare:workers';
import {customRoleId,getCustomRoles,json,me,normalizedRole,RolePrivileges,setup} from '../../../lib/store';

const keys=['deleteMessages','viewDeletedMessages','warnAccounts','pauseAccounts','banAccounts','viewAccountDetails','reviewReports','manageRoomMembers'] as const;
const reserved=new Set(['member','suggester','staff','secretary','admin','founder','creator']);

export async function GET(){
 await setup();
 const user=await me();
 if(!user)return json({error:'Please sign in before continuing.'},401);
 const roles=await getCustomRoles();
 return json({roles:normalizedRole(user.role)==='founder'?roles:roles.map(({id,name,color})=>({id,name,color}))});
}

export async function POST(req:Request){
 await setup();
 const user=await me();
 if(!user||normalizedRole(user.role)!=='founder')return json({error:'Only the founder can create custom roles.'},403);
 const body=await req.json() as {name?:string;color?:string;privileges?:Partial<RolePrivileges>};
 const name=(body.name??'').trim(),color=(body.color??'').trim();
 if(name.length<2||name.length>24||!/^[-\p{L}\p{N} ]+$/u.test(name)||reserved.has(name.toLowerCase()))return json({error:'Choose a unique role name using 2–24 letters, numbers, spaces, or hyphens.'},400);
 if(!/^#[0-9a-fA-F]{6}$/.test(color))return json({error:'Choose a valid tag color.'},400);
 const requested=body.privileges??{};
 const suspendDays=Number(requested.suspendDays??0);
 if(![0,3,7,365].includes(suspendDays))return json({error:'Choose no suspension access, or a limit of 3, 7, or 365 days.'},400);
 const privileges=Object.fromEntries(keys.map(key=>[key,requested[key]===true])) as unknown as RolePrivileges;
 privileges.suspendDays=suspendDays;
 const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM custom_roles').first<{count:number}>();
 if((count?.count??0)>=30)return json({error:'The custom role limit has been reached.'},400);
 try{
  const result=await env.DB.prepare('INSERT INTO custom_roles(name,color,privileges,created_at) VALUES(?,?,?,?)').bind(name,color,JSON.stringify(privileges),Date.now()).run();
  return json({role:{id:Number(result.meta.last_row_id),name,color,privileges}},201);
 }catch{return json({error:'That role name is already in use.'},409)}
}

export async function PATCH(req:Request){
 const user=await me();
 if(!user||normalizedRole(user.role)!=='founder')return json({error:'Only the founder can edit custom roles.'},403);
 const body=await req.json() as {id?:number;name?:string;color?:string;privileges?:Partial<RolePrivileges>};
 const id=Number(body.id),name=(body.name??'').trim(),color=(body.color??'').trim();
 if(!id||!customRoleId(`custom:${id}`))return json({error:'Choose a custom role.'},400);
 if(name.length<2||name.length>24||!/^[-\p{L}\p{N} ]+$/u.test(name)||reserved.has(name.toLowerCase()))return json({error:'Choose a role name using 2–24 letters, numbers, spaces, or hyphens.'},400);
 if(!/^#[0-9a-fA-F]{6}$/.test(color))return json({error:'Choose a valid tag color.'},400);
 const requested=body.privileges??{},suspendDays=Number(requested.suspendDays??0);
 if(![0,3,7,365].includes(suspendDays))return json({error:'Choose a valid suspension limit.'},400);
 const privileges=Object.fromEntries(keys.map(key=>[key,requested[key]===true])) as unknown as RolePrivileges;
 privileges.suspendDays=suspendDays;
 try{
  const result=await env.DB.prepare('UPDATE custom_roles SET name=?,color=?,privileges=? WHERE id=?').bind(name,color,JSON.stringify(privileges),id).run();
  return result.meta.changes?json({role:{id,name,color,privileges}}):json({error:'That role no longer exists.'},404);
 }catch{return json({error:'That role name is already in use.'},409)}
}
