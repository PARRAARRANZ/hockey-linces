import os
D=os.path.dirname(os.path.abspath(__file__)); A=os.path.join(D,'..','assets')
s=open(os.path.join(D,'index.src.html')).read()
rd=lambda f: open(os.path.join(A,f)).read().strip()
for k,f in [('__LOGO__','logo.b64'),('__JPA__','jpa.b64'),('__ESCUDO__','escudo_c.b64'),('__GUERRA__','guerra_c.b64'),('__SANTOS__','santos_c.b64')]:
    s=s.replace(k,rd(f))
s=s.replace('__CRESTS__', open(os.path.join(A,'crests.json')).read())
for k,f in [('/*__LOGIC__*/','logic.js'),('/*__RENDER__*/','render.js'),('/*__UI__*/','ui.js')]:
    s=s.replace(k,open(os.path.join(D,f)).read())
os.makedirs(os.path.join(D,'dist'),exist_ok=True)
open(os.path.join(D,'dist','index.html'),'w').write(s)
print(len(s)//1024,'KB')
# version completa para la app (Capacitor) y para publicar en cualquier web
head = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n'
        '<style>[hidden]{display:none!important}</style>\n')
i = s.index('<canvas id="gl"')
app = head + s[:i] + '</head>\n<body>\n' + s[i:] + '\n</body>\n</html>\n'
www = os.path.join(D, '..', 'apk', 'www')
os.makedirs(www, exist_ok=True)
open(os.path.join(www, 'index.html'), 'w').write(app)
