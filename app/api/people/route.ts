import {env} from 'cloudflare:workers';
import {json,me,normalizedRole,setup} from '../../../lib/store';

export async function GET(req:Request){
 await setup();
 const actor=await me();
 if(!actor)return json({error:'Sign in first.'},401);
 if(!['founder','admin','secretary'].includes(normalizedRole(actor.role)))return json({error:'Only admins and admin secretaries can view account details.'},403);
 const userId=Number(new URL(req.url).searchParams.get('userId'));
 if(!userId)return json({error:'Choose a person.'},400);
 const person=await env.DB.prepare(`SELECT id,username,name,avatar_key AS avatarKey,role,account_status AS accountStatus,suspended_until AS suspendedUntil,warnings_count AS warningsCount,created_at AS joinedAt FROM users WHERE id=?`).bind(userId).first();
 if(!person)return json({error:'Account not found.'},404);
 return json({person});
}
