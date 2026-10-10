export type SafetyCategory='language'|'bullying'|'threat'|'sexual'|'privacy'|'security';

export type SafetyResult={allowed:true}|{allowed:false;category:SafetyCategory;message:string};

const blockedWords={
 language:['fuck','fucker','motherfucker','shit','bullshit','bitch','asshole','bastard','cunt','dick','cock','pussy','piss','goddamn','wtf','stfu'],
 hate:['nigger','nigga','faggot','retard','chink','spic','kike','tranny'],
 sexual:['porn','nudes','naked','sex','sext','horny','blowjob','handjob','dildo']
} as const;

const replies:Record<SafetyCategory,string>={
 language:'That message was not sent because it contains language that is not allowed in Cat Chat.',
 bullying:'That message was not sent because it may be bullying or hurtful.',
 threat:'That message was not sent because threats or dangerous messages are not allowed.',
 sexual:'That message was not sent because sexual or explicit content is not allowed.',
 privacy:'That message was not sent because it looks like private contact information. Keep phone numbers and email addresses private.',
 security:'That message was not sent because scripts, hacking attempts, or unsafe code are not allowed in Cat Chat.'
};

const leet:Record<string,string>={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','а':'a','е':'e','і':'i','о':'o','р':'p','с':'c','х':'x','у':'y','α':'a','ε':'e','ι':'i','ο':'o','ρ':'p','χ':'x'};
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const stretchedLetter=(letter:string)=>`${escape(letter)}(?:[^a-z]*${escape(letter)})*`;
const flexibleWord=(word:string)=>new RegExp(`(?:^|[^a-z])${word.split('').map(stretchedLetter).join('[^a-z]*')}(?:$|[^a-z])`,'i');

function normalized(value:string){
 return value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/[013457@$аеіорсхуαειορχ]/gu,char=>leet[char]??char);
}

function includesBlockedWord(value:string,words:readonly string[]){
 return words.some(word=>flexibleWord(word).test(value));
}

export function checkMessageSafety(input:string):SafetyResult{
 const raw=input.trim();
 if(!raw)return {allowed:true};
 const value=normalized(raw);

 if(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw)||/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(raw))return blocked('privacy');
 if(/<\s*\/?\s*script\b/i.test(raw)||/\bjavascript\s*:/i.test(raw)||/\bdata\s*:\s*text\/html/i.test(raw)||/\bon(?:error|load|click|mouseover|focus)\s*=/i.test(raw)||/\bdocument\s*\.\s*(?:cookie|write)\b/i.test(raw)||/\b(?:eval|setTimeout|setInterval)\s*\(\s*(?:['"`]|atob\s*\()/i.test(raw)||/\b(?:union\s+select|drop\s+table|delete\s+from\s+(?:users|messages|sessions)|or\s+1\s*=\s*1)\b/i.test(raw)||/\b(?:rm\s+-rf|powershell\s+-enc|curl\s+https?:\/\/\S+\s*\|\s*(?:sh|bash)|wget\s+https?:\/\/\S+\s*\|\s*(?:sh|bash))\b/i.test(raw))return blocked('security');
 if(includesBlockedWord(value,blockedWords.hate))return blocked('bullying');
 if(includesBlockedWord(value,blockedWords.language))return blocked('language');
 if(includesBlockedWord(value,blockedWords.sexual))return blocked('sexual');
 if(/\b(?:i(?:'| a)?m\s+(?:going\s+to|gonna)|i\s+will|we\s+will)\s+(?:kill|hurt|shoot|stab|beat)\b/i.test(value)||/\b(?:kill|hurt|shoot|stab|beat)\s+(?:you|him|her|them|yourself)\b/i.test(value)||/\b(?:go\s+die|kill\s+yourself|kys)\b/i.test(value))return blocked('threat');
 if(/\b(?:you\s+are|you're|ur)\s+(?:stupid|dumb|ugly|worthless|a\s+loser|an\s+idiot|fat)\b/i.test(value)||/\b(?:nobody\s+likes\s+you|everyone\s+hates\s+you)\b/i.test(value))return blocked('bullying');
 return {allowed:true};
}

function blocked(category:SafetyCategory):SafetyResult{return {allowed:false,category,message:replies[category]}}
