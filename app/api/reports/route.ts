import {env} from 'cloudflare:workers';
import {json,me,rolePrivileges,setup} from '../../../lib/store';

export async function GET(){
 await setup();
 const user=await me();
 if(!user||!(await rolePrivileges(user.role)).reviewReports)return json({error:'Your role cannot review reports.'},403);
 const reports=await env.DB.prepare(`SELECT reports.id,reports.reason,reports.details,reports.status,reports.created_at AS createdAt,messages.body AS message,messages.user_id AS reportedUserId,reported.name AS reportedName,reported.username AS reportedUsername,reporter.name AS reporterName FROM reports JOIN messages ON messages.id=reports.message_id JOIN users reported ON reported.id=messages.user_id JOIN users reporter ON reporter.id=reports.reporter_id ORDER BY reports.created_at DESC LIMIT 100`).all();
 return json({reports:reports.results});
}

export async function POST(req:Request){
 await setup();
 const user=await me();
 if(!user)return json({error:'Please sign in before continuing.'},401);
 const b=await req.json() as {messageId:number;reason:string;details?:string};
 const reason=(b.reason??'Concern').slice(0,120),details=(b.details??'').trim().slice(0,1000);
 if(!b.messageId)return json({error:'Please choose a message.'},400);
 if(reason==='Other'&&!details)return json({error:'Please explain what happened.'},400);
 await env.DB.prepare('INSERT INTO reports(reporter_id,message_id,reason,details,status,created_at) VALUES(?,?,?,?,?,?)').bind(user.id,b.messageId,reason,details,'new',Date.now()).run();
 return json({ok:true});
}

export async function PATCH(req:Request){
 const user=await me();
 if(!user||!(await rolePrivileges(user.role)).reviewReports)return json({error:'Your role cannot review reports.'},403);
 const b=await req.json() as {id?:number;status?:string};
 if(!b.id||!['new','reviewed'].includes(b.status??''))return json({error:'The requested update is not valid.'},400);
 await env.DB.prepare('UPDATE reports SET status=? WHERE id=?').bind(b.status,b.id).run();
 return json({ok:true});
}
