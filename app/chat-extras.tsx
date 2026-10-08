'use client';

import {FormEvent,useEffect,useState} from 'react';

export type ChatPerson={id:number;username?:string;name:string;avatarKey:string|null;role:string};
export type MediaMessage={attachmentId:number|null;attachmentType:string|null;attachmentName:string|null;attachmentSize:number|null};
type MemberDetail=Omit<ChatPerson,'username'>&{username:string;joinedAt:number;accountStatus:string;suspendedUntil:number|null;warningsCount:number};

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

export function AddPeopleModal({conversationId,people,close,onAdded}:{conversationId:number;people:ChatPerson[];close:()=>void;onAdded:(chat:{id:number;name:string;type:string},count:number)=>void}){
 const [members,setMembers]=useState<number[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{fetch(`/api/chats?conversationId=${conversationId}`,{cache:'no-store'}).then(async r=>{const d=await r.json() as any;if(!r.ok)throw new Error(d.error);setMembers((d.members??[]).map((p:ChatPerson)=>p.id))}).catch(e=>setError(e instanceof Error?e.message:'Could not load this chat.')).finally(()=>setLoading(false))},[conversationId]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');const f=new FormData(e.currentTarget),memberIds=f.getAll('members').map(Number);const r=await fetch('/api/chats',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({conversationId,memberIds})}),d=await r.json() as any;if(!r.ok)return setError(d.error??'People could not be added.');onAdded(d.chat,d.added)}
 const available=people.filter(p=>!members.includes(p.id));
 return <div className="shade" onMouseDown={close}><section className="modal add-people-modal" onMouseDown={e=>e.stopPropagation()}><button className="x" onClick={close}>×</button><p className="modal-label">CHAT MEMBERS</p><h2>Add people</h2><p>People you add can see this chat and join its calls.</p>{loading?<div className="modal-loading">Loading people…</div>:<form onSubmit={submit}><fieldset><legend>Choose people</legend>{available.map(p=><label className="person" key={p.id}><input type="checkbox" name="members" value={p.id}/><Avatar person={p}/><span>{p.name}<RoleTag role={p.role}/></span></label>)}{!available.length&&<div className="all-added">Everyone available is already here.</div>}</fieldset>{error&&<strong className="modal-error">{error}</strong>}<button disabled={!available.length}>Add selected people</button></form>}</section></div>;
}

export function MemberInfoModal({userId,close}:{userId:number;close:()=>void}){
 const [person,setPerson]=useState<MemberDetail|null>(null),[error,setError]=useState('');
 useEffect(()=>{fetch(`/api/people?userId=${userId}`,{cache:'no-store'}).then(async r=>{const d=await r.json() as any;if(!r.ok)throw new Error(d.error);setPerson(d.person)}).catch(e=>setError(e instanceof Error?e.message:'Could not open this account.'))},[userId]);
 return <div className="shade member-info-shade" onMouseDown={close}><section className="member-info" onMouseDown={e=>e.stopPropagation()}><button className="x" onClick={close}>×</button>{error?<div className="member-info-error">{error}</div>:!person?<div className="modal-loading">Loading account…</div>:<><Avatar person={person}/><div className="member-title"><h2>{person.name}</h2><RoleTag role={person.role}/></div><p className="member-username">@{person.username}</p><dl><div><dt>Joined Cat Chat</dt><dd>{new Date(person.joinedAt).toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'})}</dd></div><div><dt>Account status</dt><dd className={`detail-status ${person.accountStatus}`}>{statusLabel(person)}</dd></div><div><dt>Staff warnings</dt><dd>{person.warningsCount}</dd></div></dl><p className="privacy-note">Passwords and private login information are always hidden.</p></>}</section></div>;
}

function Avatar({person}:{person:ChatPerson}){const src=avatarUrl(person.avatarKey);return <i className="detail-avatar" style={src?{backgroundImage:`url(${src})`}:undefined}>{src?'':person.name.slice(0,1).toUpperCase()}</i>}
function RoleTag({role}:{role:string}){const label=roleLabel(role);return label?<b className={`chat-role role-${role==='creator'?'founder':role}`}>{label}</b>:null}
function statusLabel(person:MemberDetail){if(person.accountStatus==='suspended'&&person.suspendedUntil)return `Suspended until ${new Date(person.suspendedUntil).toLocaleDateString()}`;return person.accountStatus.charAt(0).toUpperCase()+person.accountStatus.slice(1)}
function formatBytes(size:number|null){if(!size)return '';if(size<1_000_000)return `${Math.ceil(size/1000)} KB`;return `${(size/1_000_000).toFixed(1)} MB`}
