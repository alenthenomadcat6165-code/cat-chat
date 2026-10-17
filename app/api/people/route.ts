import {env} from 'cloudflare:workers';
import {getCustomRoles,json,me,rolePrivileges,setup} from '../../../lib/store';

export async function GET(req:Request){
 await setup();
 const actor=await me();
 if(!actor)return json({error:'Please sign in before continuing.'},401);
 if(!(await rolePrivileges(actor.role)).viewAccountDetails)return json({error:'Your role cannot view account details.'},403);
 const userId=Number(new URL(req.url).searchParams.get('userId'));
 if(!userId)return json({error:'Please choose a person.'},400);
 const person=await env.DB.prepare(`SELECT id,username,name,avatar_key AS avatarKey,role,account_status AS accountStatus,suspended_until AS suspendedUntil,warnings_count AS warningsCount,created_at AS joinedAt FROM users WHERE id=?`).bind(userId).first();
 if(!person)return json({error:'The requested account could not be found.'},404);
 return json({person,customRoles:(await getCustomRoles()).map(({id,name,color})=>({id,name,color}))});
}
