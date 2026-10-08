import {env} from 'cloudflare:workers';
import {isStaff,json,me,setup} from '../../../lib/store';

async function allowed(uid:number,cid:number){return cid===1||!!await env.DB.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').bind(cid,uid).first()}

export async function GET(req:Request){
 await setup();
 const user=await me();
 if(!user)return json({error:'Open the site again.'},401);
 const u=new URL(req.url),conversationId=Number(u.searchParams.get('conversationId')??1);
 if(!await allowed(user.id,conversationId))return json({error:'Not in this chat.'},403);
 const r=await env.DB.prepare(`SELECT * FROM (SELECT messages.id,CASE WHEN messages.deleted_at IS NULL THEN messages.body ELSE '' END AS body,messages.created_at AS createdAt,messages.edited_at AS editedAt,messages.deleted_at AS deletedAt,CASE WHEN messages.deleted_at IS NULL THEN messages.attachment_type ELSE NULL END AS attachmentType,CASE WHEN messages.deleted_at IS NULL THEN messages.attachment_name ELSE NULL END AS attachmentName,CASE WHEN messages.deleted_at IS NULL THEN messages.attachment_size ELSE NULL END AS attachmentSize,CASE WHEN messages.deleted_at IS NULL AND messages.attachment_key IS NOT NULL THEN messages.id ELSE NULL END AS attachmentId,users.id AS userId,users.name,users.avatar_key AS avatarKey,users.role FROM messages JOIN users ON users.id=messages.user_id WHERE messages.conversation_id=? ORDER BY messages.id DESC LIMIT 200) ORDER BY id`).bind(conversationId).all();
 return json({messages:r.results});
}

export async function POST(req:Request){const user=await me();if(!user)return json({error:'Open the site again.'},401);const {body,conversationId=1}=await req.json() as {body?:string;conversationId?:number};if(!await allowed(user.id,conversationId))return json({error:'Not in this chat.'},403);const text=(body??'').trim();if(!text||text.length>500)return json({error:'Write 1–500 characters.'},400);const r=await env.DB.prepare('INSERT INTO messages(user_id,body,created_at,conversation_id) VALUES(?,?,?,?)').bind(user.id,text,Date.now(),conversationId).run();return json({id:r.meta.last_row_id})}

export async function PATCH(req:Request){const user=await me();if(!user)return json({error:'Sign in first.'},401);const {id,body}=await req.json() as {id?:number;body?:string};const text=(body??'').trim();if(!id||!text||text.length>500)return json({error:'Write 1–500 characters.'},400);const r=await env.DB.prepare('UPDATE messages SET body=?,edited_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(text,Date.now(),id,user.id).run();if(!r.meta.changes)return json({error:'You can only edit your own message.'},403);return json({ok:true})}

export async function DELETE(req:Request){
 const user=await me();
 if(!user)return json({error:'Sign in first.'},401);
 const {id}=await req.json() as {id?:number};
 if(!id)return json({error:'Choose a message.'},400);
 const message=await env.DB.prepare('SELECT user_id AS userId FROM messages WHERE id=? AND deleted_at IS NULL').bind(id).first<{userId:number}>();
 if(!message)return json({error:'Message not found.'},404);
 if(message.userId!==user.id&&!isStaff(user.role))return json({error:'Only staff can delete someone else’s message.'},403);
 const now=Date.now();
 await env.DB.prepare('UPDATE messages SET deleted_at=? WHERE id=? AND deleted_at IS NULL').bind(now,id).run();
 if(message.userId!==user.id)await env.DB.prepare('INSERT INTO moderation_actions(actor_id,target_id,action,details,created_at) VALUES(?,?,?,?,?)').bind(user.id,message.userId,'delete_message',String(id),now).run();
 return json({ok:true});
}
