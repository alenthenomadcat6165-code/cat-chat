import {env} from 'cloudflare:workers';
import {json,me,setup} from '../../../../lib/store';

const limits:Record<string,number>={
 'image/jpeg':8_000_000,'image/png':8_000_000,'image/webp':8_000_000,'image/gif':8_000_000,
 'video/mp4':30_000_000,'video/webm':30_000_000,'video/quicktime':30_000_000,
 'audio/mpeg':15_000_000,'audio/mp4':15_000_000,'audio/wav':15_000_000,'audio/ogg':15_000_000,
 'application/pdf':10_000_000
};

async function allowed(userId:number,conversationId:number){
 return conversationId===1||!!await env.DB.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').bind(conversationId,userId).first();
}

export async function POST(req:Request){
 await setup();
 const user=await me();
 if(!user)return json({error:'Sign in first.'},401);
 const form=await req.formData();
 const file=form.get('file'),conversationId=Number(form.get('conversationId')??1),body=String(form.get('body')??'').trim().slice(0,500);
 if(!(file instanceof File))return json({error:'Choose a file to share.'},400);
 if(!await allowed(user.id,conversationId))return json({error:'You are not in this chat.'},403);
 const maximum=limits[file.type];
 if(!maximum)return json({error:'Share a JPG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, M4A, WAV, OGG, or PDF file.'},400);
 if(file.size<1||file.size>maximum)return json({error:`That file is too large. The limit is ${Math.round(maximum/1_000_000)} MB.`},400);
 const safeName=(file.name||'attachment').replace(/[^a-zA-Z0-9._ ()-]/g,'').slice(0,100)||'attachment';
 const key=`chat-media/${user.id}-${Date.now()}-${crypto.randomUUID()}`;
 await env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type},customMetadata:{name:safeName}});
 const result=await env.DB.prepare(`INSERT INTO messages(user_id,body,created_at,conversation_id,attachment_key,attachment_type,attachment_name,attachment_size) VALUES(?,?,?,?,?,?,?,?)`).bind(user.id,body,Date.now(),conversationId,key,file.type,safeName,file.size).run();
 return json({ok:true,id:Number(result.meta.last_row_id)});
}
