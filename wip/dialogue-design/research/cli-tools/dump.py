# dump.py <request.json> <outprefix> : writes system prompt(s), messages, tools to files
import json,sys
d=json.load(open(sys.argv[1])); b=d['body']; out=sys.argv[2]
msgs=b.get('messages') or b.get('input') or []
sysparts=[]
if 'system' in b:
    s=b['system']
    sysparts.append(s if isinstance(s,str) else '\n\n'.join(x.get('text','') for x in s))
if 'instructions' in b: sysparts.append(b['instructions'])
with open(out+'.messages.txt','w') as f:
    for i,m in enumerate(msgs):
        c=m.get('content')
        if isinstance(c,list):
            txt='\n'.join((x.get('text') or x.get('content') if isinstance(x.get('text') or x.get('content'),str) else json.dumps(x,ensure_ascii=False)) for x in c)
        else: txt=c if isinstance(c,str) else json.dumps(m,ensure_ascii=False)
        role=m.get('role') or m.get('type')
        extra=''
        if m.get('tool_calls'): extra=' TOOL_CALLS='+json.dumps(m['tool_calls'],ensure_ascii=False)
        if m.get('tool_call_id'): extra=' tool_call_id='+m['tool_call_id']
        f.write(f'===== [{i}] role={role}{extra}\n{txt}\n')
        if role=='system': sysparts.append(txt)
open(out+'.system.txt','w').write('\n\n=====SYSTEM PART=====\n\n'.join(sysparts))
json.dump(b.get('tools',[]),open(out+'.tools.json','w'),indent=2,ensure_ascii=False)
print('msgs',len(msgs),'system chars',sum(len(s) for s in sysparts),'tools',len(b.get('tools',[])))
