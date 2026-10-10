'use client';

import {FormEvent,useEffect,useState} from 'react';

export type ChatPerson={id:number;username?:string;name:string;avatarKey:string|null;role:string};
export type MediaMessage={attachmentId:number|null;attachmentType:string|null;attachmentName:string|null;attachmentSize:number|null};
type MemberDetail=Omit<ChatPerson,'username'>&{username:string;joinedAt:number;accountStatus:string;suspendedUntil:number|null;warningsCount:number};
type StaffRole='founder'|'admin'|'secretary'|'staff'|'member';
type StaffPerson={id:number;username:string;name:string;avatarKey:string|null;role:StaffRole;accountStatus:string;suspendedUntil:number|null;warningsCount:number;createdAt:number};
type StaffActor={id:number;role:StaffRole};

const roleLabel=(role:string)=>role==='creator'||role==='founder'?'Founder/Admin':role==='admin'?'Admin':role==='secretary'?'Admin Secretary':role==='staff'?'Staff/Orderly':'';
const avatarUrl=(key:string|null)=>key?`/api/avatar/${key.replace('avatars/','')}`:'';

export function AttachmentView({message}:{message:MediaMessage}){
 if(!message.attachmentId||!message.attachmentType)return null;
 const src=`/api/message-media/${message.attachmentId}`,type=message.attachmentType,name=message.attachmentName??'Attachment';
 if(type.startsWith('image/'))return <a className="message-image" href={src} target="_blank" rel="noreferrer"><img src={src} alt={name}/>{type==='image/gif'&&<b>GIF</b>}</a>;
 if(type.startsWith('video/'))return <video className="message-video" src={src} controls playsInline preload="metadata"/>;
 if(type.startsWith('audio/'))return <div className="message-audio"><span>♪ {name}</span><audio src={src} controls preload="metadata"/></div>;
 return <a className="message-file" href={src} download><span>PDF</span><div><b>{name}</b><small>{formatBytes(message.attachmentSize)}</small></div></a>;
}

export function EmojiPicker({choose,close}:{choose:(emoji:string)=>void;close:()=>void}){
 const emojis=['😀','😂','😊','😍','😎','🤩','🥳','😺','😸','😻','🙌','👏','👍','❤️','💛','💙','✨','🎉','🔥','🌈','🐾','🐈','🍕','⚽','🎮','📚','✅','💯'];
 return <div className="emoji-picker"><header><b>Choose an emoji</b><button type="button" onClick={close}>×</button></header><div>{emojis.map(emoji=><button type="button" key={emoji} onClick={()=>choose(emoji)}>{emoji}</button>)}</div></div>;
}

export function AddPeopleModal({conversationId,people,close,onChanged}:{conversationId:number;people:ChatPerson[];close:()=>void;onChanged:(chat:{id:number;name:string;type:string},count:number,action:'added'|'removed')=>void}){
 const [members,setMembers]=useState<ChatPerson[]>([]),[meId,setMeId]=useState(0),[canAdd,setCanAdd]=useState(true),[canManage,setCanManage]=useState(false),[protectedChat,setProtectedChat]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(0);
 useEffect(()=>{fetch(`/api/chats?conversationId=${conversationId}`,{cache:'no-store'}).then(async r=>{const d=await r.json() as any;if(!r.ok)throw new Error(d.error);setMembers(d.members??[]);setMeId(d.meId??0);setCanAdd(d.canAddMembers!==false);setCanManage(!!d.canManageMembers);setProtectedChat(!!d.chat?.protected)}).catch(e=>setError(e instanceof Error?e.message:'Could not load this chat.')).finally(()=>setLoading(false))},[conversationId]);
 async function change(memberIds:number[],action:'add'|'remove'){
  setError('');setBusy(memberIds[0]??-1);
  const r=await fetch('/api/chats',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({conversationId,memberIds,action})}),d=await r.json() as any;
  setBusy(0);if(!r.ok)return setError(d.error??'The chat members could not be changed.');onChanged(d.chat,d.added??d.removed,action==='add'?'added':'removed');
 }
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await change(f.getAll('members').map(Number),'add')}
 const memberIds=new Set(members.map(member=>member.id)),available=people.filter(person=>!memberIds.has(person.id));
 return <div className="shade" onMouseDown={close}><section className="modal add-people-modal" onMouseDown={e=>e.stopPropagation()}><button className="x" onClick={close}>×</button><p className="modal-label">CHAT MEMBERS</p><h2>{canAdd||canManage?'Manage people':'People in this chat'}</h2><p>{protectedChat?'This is a protected center. Only the founder can add or remove people.':'Add people to this chat. Chat creators and staff can also remove members.'}</p>{loading?<div className="modal-loading">Loading people…</div>:<><div className="current-members"><b>In this chat</b>{members.map(person=><div className="member-manage-row" key={person.id}><Avatar person={person}/><span>{person.name}<RoleTag role={person.role}/></span>{canManage&&person.id!==meId&&<button type="button" className="remove-member" disabled={busy===person.id} onClick={()=>change([person.id],'remove')}>{busy===person.id?'Removing…':'Remove'}</button>}</div>)}</div>{canAdd&&<form onSubmit={submit}><fieldset><legend>Add more people</legend>{available.map(person=><label className="person" key={person.id}><input type="checkbox" name="members" value={person.id}/><Avatar person={person}/><span>{person.name}<RoleTag role={person.role}/></span></label>)}{!available.length&&<div className="all-added">Everyone available is already here.</div>}</fieldset>{error&&<strong className="modal-error">{error}</strong>}<button disabled={!available.length||busy!==0}>Add selected people</button></form>}{!canAdd&&error&&<strong className="modal-error">{error}</strong>}</>}</section></div>;
}

export function MemberInfoModal({userId,close}:{userId:number;close:()=>void}){
 const [person,setPerson]=useState<MemberDetail|null>(null),[error,setError]=useState('');
 useEffect(()=>{fetch(`/api/people?userId=${userId}`,{cache:'no-store'}).then(async r=>{const d=await r.json() as any;if(!r.ok)throw new Error(d.error);setPerson(d.person)}).catch(e=>setError(e instanceof Error?e.message:'Could not open this account.'))},[userId]);
 return <div className="shade member-info-shade" onMouseDown={close}><section className="member-info" onMouseDown={e=>e.stopPropagation()}><button className="x" onClick={close}>×</button>{error?<div className="member-info-error">{error}</div>:!person?<div className="modal-loading">Loading account…</div>:<><Avatar person={person}/><div className="member-title"><h2>{person.name}</h2><RoleTag role={person.role}/></div><p className="member-username">@{person.username}</p><dl><div><dt>Joined Cat Chat</dt><dd>{new Date(person.joinedAt).toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'})}</dd></div><div><dt>Account status</dt><dd className={`detail-status ${person.accountStatus}`}>{statusLabel(person)}</dd></div><div><dt>Staff warnings</dt><dd>{person.warningsCount}</dd></div></dl><p className="privacy-note">Passwords and private login information are always hidden.</p></>}</section></div>;
}

export function StaffPanel({role,close}:{role:string;close:()=>void}){
 const [people,setPeople]=useState<StaffPerson[]>([]),[actor,setActor]=useState<StaffActor|null>(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[search,setSearch]=useState(''),[busy,setBusy]=useState<number|null>(null);
 async function load(){
  try{const r=await fetch('/api/moderation',{cache:'no-store'}),d=await r.json() as any;if(!r.ok)throw new Error(d.error);setPeople(d.users??[]);setActor(d.me??null)}catch(e){setNotice(e instanceof Error?e.message:'The staff panel could not load.')}finally{setLoading(false)}
 }
 useEffect(()=>{load()},[]);
 async function moderate(person:StaffPerson,action:string,extra:Record<string,unknown>={}){
  setBusy(person.id);setNotice('');
  try{const r=await fetch('/api/moderation',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({userId:person.id,action,...extra})}),d=await r.json() as any;setNotice(d.message??d.error??'Account updated.');if(r.ok)await load()}catch{setNotice('That action could not be completed.')}finally{setBusy(null)}
 }
 function warn(person:StaffPerson){const reason=prompt(`What warning should ${person.name} receive?`);if(reason?.trim())moderate(person,'warn',{reason})}
 function suspend(person:StaffPerson){if(!actor)return;const max=actor.role==='staff'?3:actor.role==='secretary'?7:365,answer=prompt(`Suspend ${person.name} for how many days? (1–${max})`);if(!answer)return;const days=Number(answer);if(!Number.isInteger(days)||days<1||days>max)return setNotice(`Choose a whole number from 1 to ${max}.`);const reason=prompt('Reason for the suspension (optional):')??'';moderate(person,'suspend',{days,reason})}
 function accountAction(person:StaffPerson,action:'pause'|'ban'|'restore'){const word=action==='ban'?'permanently ban':action;if(confirm(`${word} ${person.name}'s account?`))moderate(person,action)}
 async function restartChat(){
  if(!confirm('Restart Cat Chat? This permanently clears every message and every ordinary group/private chat. Accounts and the two protected centers stay.'))return;
  const confirmation=prompt('Type RESET CAT CHAT exactly to continue.');
  if(confirmation!=='RESET CAT CHAT')return setNotice('Restart cancelled. The confirmation did not match.');
  setNotice('Restarting Cat Chat…');
  const response=await fetch('/api/founder/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmation})}),data=await response.json() as any;
  if(!response.ok)return setNotice(data.error??'Cat Chat could not be restarted.');
  alert(data.message);location.href='/';
 }
 const current=actor?.role??normalizeRole(role),currentRank=staffRank[current]??0,title=current==='founder'?'Founder full control':current==='admin'?'Admin control panel':current==='secretary'?'Admin Secretary panel':'Staff / Orderly panel';
 const shown=people.filter(person=>`${person.name} ${person.username}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="shade staff-tools-shade" onMouseDown={close}><section className="staff-tools" onMouseDown={e=>e.stopPropagation()}><header><div><p>CAT CHAT SAFETY</p><h2>{title}</h2><RoleTag role={current}/></div><button className="x" onClick={close}>×</button></header><div className="staff-power-strip"><span>{currentRank>=1?'✓ Warn and delete messages':''}</span>{currentRank>=1&&<span>✓ Suspend up to {current==='staff'?'3':current==='secretary'?'7':'365'} days</span>}{currentRank>=2&&<span>✓ Pause accounts</span>}<span>✓ Unpause or unsuspend allowed accounts</span>{currentRank>=3&&<span>✓ Permanent bans</span>}{current==='founder'&&<span>✓ Choose staff roles</span>}</div><div className="staff-panel-nav"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search people…"/><a href="/creator">Reports & full dashboard →</a></div>{current==='founder'&&<div className="founder-reset-card"><div><b>Restart the whole chat</b><span>Keep accounts and protected centers, but clear every message and ordinary chat.</span></div><button onClick={restartChat}>Restart Cat Chat</button></div>}{notice&&<div className="staff-tools-notice" onClick={()=>setNotice('')}>{notice}</div>}{loading?<div className="modal-loading">Opening your controls…</div>:<div className="staff-people-list">{shown.map(person=>{const rank=staffRank[normalizeRole(person.role)]??0,manageable=!!actor&&person.id!==actor.id&&currentRank>rank,canRestore=manageable&&(person.accountStatus==='suspended'||(currentRank>=2&&person.accountStatus==='paused'));return <article key={person.id}><div className="staff-person-main"><Avatar person={person}/><div><div><b>{person.name}</b><RoleTag role={person.role}/></div><small>@{person.username} · {person.warningsCount} warnings · joined {new Date(person.createdAt).toLocaleDateString()}</small></div><span className={`staff-status ${person.accountStatus}`}>{accountStatusText(person)}</span></div>{current==='founder'&&person.id!==actor?.id&&normalizeRole(person.role)!=='founder'&&<label className="inline-role">Role<select value={normalizeRole(person.role)} onChange={e=>moderate(person,'role',{role:e.target.value})} disabled={busy===person.id}><option value="member">Member</option><option value="admin">Admin</option><option value="secretary">Admin Secretary</option><option value="staff">Staff/Orderly</option></select></label>}{manageable?<div className="staff-action-buttons"><button onClick={()=>warn(person)} disabled={busy===person.id}>⚠ Warn</button><button onClick={()=>suspend(person)} disabled={busy===person.id}>⏳ Suspend</button>{currentRank>=2&&<button onClick={()=>accountAction(person,'pause')} disabled={busy===person.id}>Ⅱ Pause</button>}{canRestore&&<button className="restore" onClick={()=>accountAction(person,'restore')} disabled={busy===person.id}>✓ Unpause / unsuspend</button>}{currentRank>=3&&<button className="danger" onClick={()=>accountAction(person,'ban')} disabled={busy===person.id}>Permanent ban</button>}</div>:<small className="staff-protected">{person.id===actor?.id?'This is your account.':'Protected at your staff level.'}</small>}</article>})}</div>}<footer><span>Newest accounts appear at the bottom. Permanent bans disappear.</span><button onClick={close}>Back to chat</button></footer></section></div>;
}

function Avatar({person}:{person:ChatPerson}){const src=avatarUrl(person.avatarKey);return <i className="detail-avatar" style={src?{backgroundImage:`url(${src})`}:undefined}>{src?'':person.name.slice(0,1).toUpperCase()}</i>}
function RoleTag({role}:{role:string}){const label=roleLabel(role);return label?<b className={`chat-role role-${role==='creator'?'founder':role}`}>{label}</b>:null}
function statusLabel(person:MemberDetail){if(person.accountStatus==='suspended'&&person.suspendedUntil)return `Suspended until ${new Date(person.suspendedUntil).toLocaleDateString()}`;return person.accountStatus.charAt(0).toUpperCase()+person.accountStatus.slice(1)}
const staffRank:Record<StaffRole,number>={member:0,staff:1,secretary:2,admin:3,founder:4};
function normalizeRole(role:string):StaffRole{return role==='creator'?'founder':(['founder','admin','secretary','staff'].includes(role)?role:'member') as StaffRole}
function accountStatusText(person:StaffPerson){if(person.accountStatus==='suspended'&&person.suspendedUntil)return `Suspended until ${new Date(person.suspendedUntil).toLocaleDateString()}`;return person.accountStatus.charAt(0).toUpperCase()+person.accountStatus.slice(1)}
function formatBytes(size:number|null){if(!size)return '';if(size<1_000_000)return `${Math.ceil(size/1000)} KB`;return `${(size/1_000_000).toFixed(1)} MB`}
