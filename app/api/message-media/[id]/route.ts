import {env} from 'cloudflare:workers';
import {me} from '../../../../lib/store';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const user=await me();
 if(!user)return new Response('Sign in first.',{status:401});
 const {id}=await params;
 const message=await env.DB.prepare(`SELECT messages.attachment_key AS attachmentKey,messages.attachment_type AS attachmentType,messages.attachment_name AS attachmentName,messages.conversation_id AS conversationId,messages.deleted_at AS deletedAt FROM messages WHERE messages.id=?`).bind(Number(id)).first<{attachmentKey:string|null;attachmentType:string|null;attachmentName:string|null;conversationId:number;deletedAt:number|null}>();
 if(!message?.attachmentKey||message.deletedAt)return new Response('Not found',{status:404});
 if(message.conversationId!==1){
  const member=await env.DB.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').bind(message.conversationId,user.id).first();
  if(!member)return new Response('Not allowed',{status:403});
 }
 const object=await env.FILES.get(message.attachmentKey);
 if(!object)return new Response('Not found',{status:404});
 const type=message.attachmentType??object.httpMetadata?.contentType??'application/octet-stream';
 const inline=type.startsWith('image/')||type.startsWith('video/')||type.startsWith('audio/');
 const safeName=(message.attachmentName??'attachment').replace(/["\\\r\n]/g,'_');
 return new Response(object.body,{headers:{
  'content-type':type,
  'content-length':String(object.size),
  'content-disposition':`${inline?'inline':'attachment'}; filename="${safeName}"`,
  'cache-control':'private,max-age=3600',
  'x-content-type-options':'nosniff'
 }});
}
