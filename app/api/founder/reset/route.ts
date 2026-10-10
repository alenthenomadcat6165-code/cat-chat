import {env} from 'cloudflare:workers';
import {json,me,normalizedRole} from '../../../../lib/store';
import {deleteStoredFiles,ensureProtectedChats} from '../../../../lib/protected-chats';

export async function POST(req:Request){
 const user=await me();
 if(!user||normalizedRole(user.role)!=='founder')return json({error:'Founder access only.'},403);
 const body=await req.json() as {confirmation?:string};
 if(body.confirmation!=='RESET CAT CHAT')return json({error:'Type RESET CAT CHAT exactly to confirm.'},400);
 await ensureProtectedChats();
 const attachments=await env.DB.prepare("SELECT attachment_key AS attachmentKey FROM messages WHERE attachment_key IS NOT NULL").all<{attachmentKey:string}>();
 const messageCount=await env.DB.prepare('SELECT COUNT(*) AS count FROM messages').first<{count:number}>();
 const chatCount=await env.DB.prepare("SELECT COUNT(*) AS count FROM conversations WHERE type NOT IN ('main','admin_center','staff_center')").first<{count:number}>();
 const now=Date.now();
 await env.DB.batch([
  env.DB.prepare('DELETE FROM reports'),
  env.DB.prepare('DELETE FROM call_signals'),
  env.DB.prepare('DELETE FROM call_participants'),
  env.DB.prepare('DELETE FROM call_sessions'),
  env.DB.prepare('DELETE FROM typing_presence'),
  env.DB.prepare('DELETE FROM messages'),
  env.DB.prepare("DELETE FROM conversation_members WHERE conversation_id IN (SELECT id FROM conversations WHERE type NOT IN ('main','admin_center','staff_center'))"),
  env.DB.prepare("DELETE FROM conversations WHERE type NOT IN ('main','admin_center','staff_center')"),
  env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(user.id,user.id,'restart_chat',`${messageCount?.count??0} messages; ${chatCount?.count??0} chats`,now)
 ]);
 await ensureProtectedChats();
 await deleteStoredFiles(attachments.results.map(item=>item.attachmentKey)).catch(()=>{});
 return json({ok:true,message:`Cat Chat restarted. ${messageCount?.count??0} messages and ${chatCount?.count??0} chats were cleared. Every account was preserved.`});
}
