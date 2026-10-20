import sys, zlib, gzip, io
p=sys.argv[1]; out=sys.argv[2]
data=open(p,'rb').read()
sig=b'\x1f\x8b\x08'
i=0; found=[]
while True:
    i=data.find(sig,i)
    if i<0: break
    try:
        d=zlib.decompressobj(16+zlib.MAX_WBITS)
        res=d.decompress(data[i:i+400_000_000])
        if len(res)>1_000_000 and res[257:262]==b'ustar':
            found.append((i,len(res)))
            open(out,'wb').write(res)
            print('found tar at',i,len(res)); break
    except Exception as e:
        pass
    i+=1
