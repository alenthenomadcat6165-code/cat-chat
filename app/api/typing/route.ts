import {env} from 'cloudflare:workers';
import {json,me} from '../../../lib/store';

async function allowed(userId:number,conversationId:number){
 return conversationId===1||!!await env.DB.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').bind(conversationId,userId).first();
}

export async function GET(req:Request){
 const user=await me();
 if(!user)return json({error:'Sign in first.'},401);
 const conversationId=Number(new URL(req.url).searchParams.get('conversationId')??1);
 if(!await allowed(user.id,conversationId))return json({error:'You are not in this chat.'},403);
 const activeSince=Date.now()-4500;
 const people=await env.DB.prepare(`SELECT users.id,users.name FROM typing_presence JOIN users ON users.id=typing_presence.user_id WHERE typing_presence.conversation_id=? AND typing_presence.user_id!=? AND typing_presence.updated_at>? AND users.account_status='active' AND users.banned=0 ORDER BY typing_presence.updated_at DESC LIMIT 4`).bind(conversationId,user.id,activeSince).all();
 return json({people:people.results});
}

export async function POST(req:Request){
 const user=await me();
 if(!user)return json({error:'Sign in first.'},401);
 const body=await req.json() as {conversationId?:number;typing?:boolean};
 const conversationId=Number(body.conversationId??1);
 if(!await allowed(user.id,conversationId))return json({error:'You are not in this chat.'},403);
 if(body.typing){
  await env.DB.prepare('INSERT INTO typing_presence(conversation_id,user_id,updated_at) VALUES(?,?,?) ON CONFLICT(conversation_id,user_id) DO UPDATE SET updated_at=excluded.updated_at').bind(conversationId,user.id,Date.now()).run();
 }else{
  await env.DB.prepare('DELETE FROM typing_presence WHERE conversation_id=? AND user_id=?').bind(conversationId,user.id).run();
 }
 return json({ok:true});
}
