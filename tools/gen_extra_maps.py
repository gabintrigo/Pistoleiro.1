import json
H,W=20,30
def base():
    g=[['.']*W for _ in range(H)]
    for c in range(W): g[0][c]=g[H-1][c]='#'
    for r in range(H): g[r][0]=g[r][W-1]='#'
    for r in (9,10): g[r][1]='G'; g[r][28]='G'
    for (r,c) in [(1,1),(1,27),(8,1),(8,28)]: g[r][c]='s'; g[H-1-r][c]='s'
    g[9][14]='P'; return g
def stamp(g,items):
    for (r,c,ch) in items:
        g[r][c]=ch
        mr=(18-r) if ch=='B' else (19-r)
        g[mr][c]=ch
def row(r,cols,ch): return [(r,c,ch) for c in cols]
def col(c,rows,ch): return [(r,c,ch) for r in rows]
M={}
# Itália — Piazza: colunata à volta da praça, fonte, ruas de casinhas nos cantos
g=base(); stamp(g, row(5,[8,9,11,12,17,18,20,21],'w')+[(7,14,'K'),(7,12,'b'),(7,16,'b'),(3,4,'T'),(3,25,'T'),(2,9,'B'),(6,5,'M'),(4,14,'L'),(7,8,'c'),(7,20,'c'),(6,24,'V')]+row(2,[19,20,22,23],'C')+row(3,[3],'C')); M['ita']=g
# Inglaterra — ruas de Londres: filas de casinhas geminadas com becos, carros estacionados
g=base(); stamp(g, row(3,[5,6,7,9,10,11,17,18,19,21,22,23],'C')+row(6,[9,10,12,13,16,17,19,20],'C')+[(4,8,'b'),(4,20,'b'),(7,6,'V'),(7,22,'V'),(2,2,'T'),(2,26,'T'),(7,12,'B'),(4,26,'M'),(5,2,'L'),(5,14,'c')]); M['eng']=g
# Países Baixos — canais: margens compridas com pontes estreitas
g=base(); stamp(g, row(4,list(range(3,8))+list(range(9,14))+list(range(15,20))+list(range(21,27)),'J')+row(7,list(range(5,10))+list(range(11,18))+list(range(19,25)),'S')+[(2,6,'T'),(2,22,'T'),(5,12,'B'),(5,26,'M'),(5,2,'L'),(8,9,'c'),(8,19,'c'),(2,14,'C'),(2,15,'C')]); M['ned']=g
# Uruguai — porto: pilhas de contentores com corredores de cais
g=base(); stamp(g, [(2,c,'C') for c in (4,5,6,11,12,13,16,17,18,23,24,25)]+[(3,c,'K') for c in (4,5,6,11,12,13,16,17,18,23,24,25)]+row(6,[7,8,9,20,21,22],'C')+[(5,3,'T'),(5,26,'T'),(7,11,'B'),(7,24,'M'),(4,20,'L'),(5,12,'b'),(5,17,'b'),(8,6,'K'),(8,22,'K')]); M['uru']=g
# Japão — jardim-labirinto: muros baixos em L, torres de vigia, casas de chá
g=base(); stamp(g, col(6,[2,3,4],'w')+col(23,[2,3,4],'w')+col(10,[5,6,7],'w')+col(19,[5,6,7],'w')+row(5,[3,4,5],'w')+row(5,[24,25,26],'w')+row(7,[12,13],'w')+row(7,[16,17],'w')+[(3,10,'T'),(3,19,'T'),(1,13,'B'),(8,6,'M'),(4,14,'L'),(6,3,'C'),(6,26,'C'),(2,16,'c')]); M['jpn']=g
# cortar corredores de 100 m: barris nas faixas junto ao limite, caixotes nas laterais, sacos de areia na faixa central
for k,g in M.items():
    for (r,c,ch) in [(1,9,'b'),(1,20,'b'),(8,7,'c'),(8,21,'c'),(9,5,'S'),(9,23,'S')]:
        if g[r][c]=='.' and g[19-r][c]=='.': g[r][c]=ch; g[19-r][c]=ch
# verificação: o jogador chega a todas as zonas livres e a todas as entradas de inimigos
WALK=set('.sPL')
for k,g in M.items():
    blk=[[g[r][c] not in WALK for c in range(W)] for r in range(H)]
    for r in range(H):
        for c in range(W):
            if g[r][c]=='B':
                for dr in (0,1):
                    for dc in (0,1): blk[r+dr][c+dc]=True
    seen=set([(9,14)]);q=[(9,14)]
    while q:
        r,c=q.pop()
        for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
            rr,cc=r+dr,c+dc
            if 0<=rr<H and 0<=cc<W and not blk[rr][cc] and (rr,cc) not in seen: seen.add((rr,cc));q.append((rr,cc))
    free=[(r,c) for r in range(H) for c in range(W) if not blk[r][c]]
    unreach=[p for p in free if p not in seen]
    sp=[(r,c) for r in range(H) for c in range(W) if g[r][c]=='s']
    cnt={ch:sum(row.count(ch) for row in g) for ch in 'CTBMLKcbwSJV'}
    print(k,'livres',len(free),'inalcançáveis',len(unreach),'entradas alcançáveis',sum(1 for p in sp if p in seen),'/',len(sp),{a:b for a,b in cnt.items() if b})
json.dump({k:[''.join(r) for r in g] for k,g in M.items()},open('/tmp/maps/layouts.json','w'))

