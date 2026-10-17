import {env} from 'cloudflare:workers';
import {getCustomRoles,json,me,normalizedRole,rolePrivileges,setup} from '../../../lib/store';
import {ensureProtectedChats,isProtectedChat} from '../../../lib/protected-chats';

export async function GET(){
 await setup();
 const user=await me();
 if(!user)return json({error:'Please open the site again before continuing.'},401);
 await ensureProtectedChats();
 const founder=normalizedRole(user.role)==='founder';
 const chats=await env.DB.prepare(`SELECT conversations.id,conversations.name,conversations.type,conversations.created_by AS createdBy,
  CASE WHEN conversation_members.user_id IS NULL THEN 0 ELSE 1 END AS isMember
  FROM conversations LEFT JOIN conversation_members ON conversation_members.conversation_id=conversations.id AND conversation_members.user_id=?
  WHERE ?=1 OR conversation_members.user_id IS NOT NULL
  ORDER BY CASE conversations.type WHEN 'admin_center' THEN 0 WHEN 'staff_center' THEN 1 WHEN 'suggester_center' THEN 2 ELSE 3 END,conversations.created_at DESC`).bind(user.id,founder?1:0).all<{id:number;name:string;type:string;createdBy:number;isMember:number}>();
 const people=await env.DB.prepare("SELECT id,name,avatar_key AS avatarKey,role FROM users WHERE id!=? AND banned=0 AND account_status='active' ORDER BY name").bind(user.id).all();
 const privateRooms=chats.results.filter(chat=>chat.type==='private');
 const privateNames=new Map<number,string>();
 if(privateRooms.length&&founder){
  const rows=await env.DB.prepare(`SELECT conversation_members.conversation_id AS conversationId,users.name FROM conversation_members JOIN users ON users.id=conversation_members.user_id WHERE conversation_members.conversation_id IN (${privateRooms.map(()=>'?').join(',')}) ORDER BY users.name`).bind(...privateRooms.map(chat=>chat.id)).all<{conversationId:number;name:string}>();
  for(const row of rows.results)privateNames.set(row.conversationId,[privateNames.get(row.conversationId),row.name].filter(Boolean).join(', '));
 }
 const visible=chats.results.filter(chat=>chat.id!==1).map(chat=>({
  ...chat,name:founder&&chat.type==='private'?`Private: ${privateNames.get(chat.id)??chat.id}`:chat.name,
  protected:isProtectedChat(chat.type),canDelete:chat.type==='group'&&chat.createdBy===user.id,
  readOnly:!chat.isMember
 }));
 return json({chats:[{id:1,name:'Main School Room',type:'main',protected:true,canDelete:false,readOnly:false},...visible],people:people.results,customRoles:(await getCustomRoles()).map(({id,name,color})=>({id,name,color})),privileges:await rolePrivileges(user.role)});
}
