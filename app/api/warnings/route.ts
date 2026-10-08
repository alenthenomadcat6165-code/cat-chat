import {env} from 'cloudflare:workers';
import {json,me,setup} from '../../../lib/store';

export async function GET(){
 await setup();
 const user=await me();
 if(!user)return json({error:'Sign in first.'},401);
 const warning=await env.DB.prepare(`SELECT warnings.id,warnings.message,warnings.created_at AS createdAt,users.name AS issuedBy FROM warnings JOIN users ON users.id=warnings.issued_by WHERE warnings.user_id=? AND warnings.acknowledged_at IS NULL ORDER BY warnings.created_at LIMIT 1`).bind(user.id).first();
 return json({warning:warning??null});
}

export async function PATCH(req:Request){
 await setup();
 const user=await me();
 if(!user)return json({error:'Sign in first.'},401);
 const {id}=await req.json() as {id?:number};
 if(!id)return json({error:'Choose a warning.'},400);
 await env.DB.prepare('UPDATE warnings SET acknowledged_at=? WHERE id=? AND user_id=?').bind(Date.now(),id,user.id).run();
 return json({ok:true});
}
