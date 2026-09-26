# REGRESSO DO PISTOLEIRO — Documento de passagem (26 set 2026)

Lê isto primeiro numa conversa nova. Está tudo o que é preciso para continuar sem perder nada.

## 0. Como repor o projeto numa conversa nova (sem uploads)
O código-fonte completo está no GitHub, no ramo `source` do repositório público do site:
```
git clone -b source --depth 1 https://github.com/gabintrigo/Pistoleiro.1.git /home/claude/rdp
cd /home/claude/rdp && npm install
```
- O ramo `main` do mesmo repositório é só o site publicado (conteúdo de `dist/` + `.nojekyll`).
- `assets/src/quaternius/` (67 MB) já vem no ramo `source`: animações UAL1 (Source) e os dois corpos Universal Base Characters.
- Harness visual WebKit: `tools/wk/shot.py` (ver §6). Ficheiro único para Documentos: `node tools/singlefile.mjs <saída.html>`.

## 1. O que é o jogo
FPS mobile em three.js/Vite, PWA offline, sátira de futebol: o Pistoleiro (Leões) enfrenta seleções (Espanha, Brasil, Alemanha, França, Argentina, Itália, Portugal, CFT…) em estádios. Alvo: iPhone (Gabriel tem iPhone 17 Pro Max; em paisagem o jogo vê **812×375 pontos** com zonas de segurança laterais — testar SEMPRE com 812×375). Site: https://gabintrigo.github.io/Pistoleiro.1/ . Dono: Gabriel (PT-PT, tratar por tu). Estilo de UI: linguagem de jogo tipo Call of Duty Mobile / Combat Master (cantos cortados `--clip`, dourado `--gold:#f2c94c`, tinta `--ink:#0b0e13`, fonte Oswald condensada embutida, **sem emojis**, só glifos ✕ ▸ ↻ ❚❚).

## 2. Estado atual (tudo publicado e a funcionar)
- **Modos:** História (5 jogos por seleção, mapa-mundo, postais, túnel de escolha, olheiro), Contra-relógio, Prolongamento (endless), 5 contra 5 (`tdm`), Roubar a Bola (`ball`), Petardo no camarote (`bomb`). Modos rápidos arrancam do zero (`startGame({quick:true})`).
- **Armas:** 20 com modelo 3D próprio (Blender `tools/blender/build_weapons.py`), categorias, tipos de dano × proteções (`ARMOR_MULT`), mestria 10 níveis, armeiro (cano/carregador/mecanismo), acessórios, pinturas (a imagem grande da loja usa `weaponIcons['__skin_'+k]`).
- **Combate afinado nesta sessão:** inimigos atacam dentro de edifícios (linha de vista no mesmo edifício <12 m); atiradores acertam a distância (fórmula própria d/320); disparo automático só dentro do alcance útil e, nas snipers, só ao apontar; sniper sem mira dispersa 9×; caçadeiras de alcance curto (M870 6–12 m, Serra 12 4–9 m, M4 Bunker 7–14 m).
- **UI:** lobby v3 (lista de modos à esquerda com renders do estádio, arma equipada em 3D a rodar ao centro, desafio diário + olheiro à direita, JOGAR = continuar história; `#play` escondido abre o menu de modos), loja em 3 colunas (carrossel/arma/ação) com mosaicos compactos nos outros separadores, HUD com painéis à esquerda e ataque aéreo sob o painel da arma, pausa, resultados, mapa-mundo, túnel, carregamento com logótipo, vinheta de vida baixa, marca de acerto com impulso (amarela na cabeça), números de dano na Oswald.
- **Personagem NOVA (ponto 1 do plano de assets) — JÁ COM CORPOS REAIS:** `CHAR_ASSET='ubc_male'` em `initCharacters` (Game.js). Esqueleto Quaternius de 65 ossos renomeado para a convenção do código (Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder/Arm/ForeArm/Hand, RightShoulder/…, LeftUpLeg/Leg/Foot/ToeBase, RightUpLeg/…), 37 clips separados pernas/tronco (`tools/ual_common.mjs` transfere-os por nome de osso). Corpos `public/assets/characters/ubc_male.glb` (1,34 MB) e `ubc_female.glb` (1,31 MB), construídos por `tools/ual_body.mjs <corpo.gltf> <nome>`. Equipamento por shader: regiões (camisola, calções, meias, pele) em `COLOR_0` calculadas por peso de osso e posição ao longo do osso; o material do corpo injeta via `onBeforeCompile` uma mistura da textura de pele com as cores da seleção (`CharacterInstance.setKit(shirt,shorts,socks,tone,hair)`, `meta.kitShader` no manifesto); tom de pele por multiplicador. Publicado (commit 221edc9 do ramo `main`, site construído). Estado visual verificado em WebKit: caras, olhos, capacetes, coletes e cores certas; **defeitos conhecidos**: (a) as fronteiras entre regiões ficam em degradê (a cor interpola entre vértices de regiões diferentes) — camisola vermelha a fundir com calções azuis; (b) carecas: a malha "Hair"/"Face" é sobrancelhas; os penteados são glTFs separados do pacote, ainda não enviados. Reservas no manifesto: `ual_mannequin` (manequim) e `human_base` (antiga, MakeHuman+Mixamo): basta mudar `CHAR_ASSET`.

## 3. Ficheiros e ferramentas importantes
| Ficheiro | Para quê |
|---|---|
| `src/game/Game.js` | quase toda a lógica (modos, IA, HUD, loja, menus). Funções-chave: `initCharacters`, `dressEnemy`, `placeMenuModel`/`menuThumbs`/`renderSceneThumb`, `renderWeaponIcons`, `refreshMenu`, `enemyFire`, `updateEnemy`, `tdmStart`, `startGame`, `openMenuShop`/`closeShop` |
| `src/characters/Character.js` | `CharacterTemplate`/`CharacterInstance`: clips LOWER/UPPER/ONESHOT/FULL, `setColors` (modo `flat`), `_autoRifle` (orientação da arma a partir da pose `aim`), `setGear`, LODs, hitboxes |
| `src/game/Data.js` | seleções (`TEAMS`: shirt/shorts/socks/gk/traits/scout…), armas (`WEAPONS`, falloff/spread/range), `WSTAGE`, economia |
| `src/assets/manifest.json` + `AssetRegistry.js` | `registry.character(name)` lê `characters[name]`; `meta.flatKit` ativa cores planas |
| `index.html` | todo o CSS (várias secções acrescentadas no fim; a última ganha) |
| `tools/ual_pack.mjs` | empacota animações da UAL (só as úteis, sem dedos, meshopt) |
| `tools/ual_character.mjs` | constrói `public/assets/characters/ual_mannequin.glb` (manequim) a partir de `assets/src/quaternius/ual/UAL1.glb` e escreve a entrada do manifesto. `MAP` = nome no jogo → [clip origem, lower/upper/full] |
| `tools/ual_body.mjs` + `tools/ual_common.mjs` | **constrói os corpos** `ubc_male`/`ubc_female` (ossos renomeados, 37 clips transferidos, regiões de equipamento em COLOR_0, texturas reduzidas, meshopt) e as entradas do manifesto (`meta.kitShader`). Lê a UAL de `assets/src/quaternius/ual/UAL1.glb` (ou `UAL1=<caminho>`) |
| `tools/import.mjs` | pipeline dos outros modelos (meshopt/KTX2). ATENÇÃO: se regenerar o manifesto, voltar a correr `tools/ual_character.mjs` |
| `tools/singlefile.mjs` | HTML único (27 MB) para abrir dos Documentos |
| `tools/harness_*.mjs` | testes em node: `node`, `full` (campanha inteira), `ai`, `gear`, `roof`, `parkour`, `perf`, `tdm`, `ball`, `ball2`, `bomb`, `matchups`, `line`, `economy`, `hitch`, `house_fire`, `sniper` |
| `tools/wk/shot.py` + `steps_*.json` | capturas WebKit (ver §6) |
| `tools/LEIA-ME-publicar.txt` | instruções de publicação para o Gabriel |
| `README.md` | histórico técnico detalhado por fase (ler as últimas secções) |

Comandos: `npx vite build` → `dist/`; testes: `timeout 250 node tools/harness_node.mjs` e `harness_full.mjs` devem imprimir `NODE HARNESS OK` / `FULL HARNESS OK`.

## 4. Assets Quaternius (CC0) já no projeto
- `assets/src/quaternius/ual/UAL1.glb` (sem root motion, usar este) e `UAL1_RM.glb` (com root motion, só para medir velocidades). 120 animações; forward = +Z (o `inner.rotation.y=Math.PI` do Character.js mantém-se). Velocidades medidas: Walk 1,0 m/s; Jog lateral/trás 3,2 m/s; jog frente/sprint têm valores irreais no ficheiro — usadas 3,2 e 5,5 (`gait` em `initCharacters`).
- `assets/src/quaternius/ubc/Superhero_Male_FullBody.gltf` (+.bin): malhas `Face` (=cabelo, material MI_Hair_1), `Face.001` (olhos, MI_Eyes), corpo `Sphere.005_Retopology.004` 12 566 tris (MI_Superhero_Male); 65 ossos = mesmo rig; 1,82 m. `Superhero_Female_FullBody.gltf`: `Eyebrows` (MI_Hair_2), `Eyes`, `Superhero_Female` 12 812 tris; 1,78 m.
- Texturas completas em `assets/src/quaternius/ubc/` (originais 2048) e `ubc/small/` (reduzidas: pele 1024 JPEG, normais 512, cabelo/olhos 512/256 — são estas que `tools/ual_body.mjs` embute). Só vieram os dois corpos "Superhero" e as texturas de 2 penteados; faltam os glTFs dos penteados (20 no pacote), os corpos "Regular"/"Teen" e os outros tons de pele — pedir ao Gabriel a pasta de penteados do zip.
- Ainda não integrado: UAL2 (parkour/combos; Gabriel disse ter 2 ficheiros para enviar).

## 5. PRÓXIMOS PASSOS (onde ficámos)
1. **Fronteiras nítidas do equipamento.** Hoje `COLOR_0` guarda pesos contínuos e o shader mistura → degradê entre camisola e calções. Corrigir em `tools/ual_body.mjs`: escolher UMA região por vértice (a de maior peso) e, no shader (`Character.js`, `setKit`/`onBeforeCompile`), selecionar a cor pela região dominante em vez de misturar (ou duplicar vértices na fronteira). Objetivo: linha de camisola/calção nítida à cintura, mangas até meio do braço, meias até ao joelho.
2. **Cabelo:** integrar os penteados (glTFs do pacote, mesmo rig/cabeça) como malha `Hair` com material `hair` (classe `Hair` já reconhecida por `meshClass`); cor de cabelo já vem em `o.hair`. Até chegarem, os inimigos são carecas.
3. **Números nas costas e emblema:** o plano de número (`numberPlane` em Spine2) já existe; verificar posição no novo tronco. Opcional: decalque no próprio shader.
4. **Variedade:** usar `ubc_female` em alguns papéis (extremos/pontas), tons de pele por seleção (`o.skin`), 2–3 penteados.
5. **Personagem de menu:** voltar a mostrar `pmodel` no lobby (`placeMenuModel`, hoje escondido) com `Celebration`/`Idle_LookAround_Loop`, ao lado da montra da arma.
6. **Equipamentos (capacete, colete, caneleiras) e escudo:** confirmar offsets em `setGear` com o novo corpo (Head/Spine2/LeftLeg/RightLeg/LeftArm/RightArm).
7. **Desempenho:** 14 k tris por inimigo × 16 → se o iPhone aquecer, gerar LOD1 com `simplify` do gltf-transform (ou reutilizar o manequim de 13,7 k como LOD… não vale a pena) e reduzir a 6–7 k.
8. Depois: UAL2 (parkour/combos), sons (Sonniss GDC 2026 + Kenney; Gabriel escolhe ~60), ícones Kenney CC0, música Pixabay. Opcional pago: Synty Battle Royale (49,99 $) para props/cenário.

## 6. Como testar visualmente (WebKit, 812×375)
```
node tools/singlefile.mjs /home/claude/wk/game.html
cd /home/claude/wk && rm -rf /root/.cache/shot.py /root/.local/share/shot.py
LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe timeout 200 xvfb-run -a -s "-screen 0 1280x800x24" \
  python3 /home/claude/rdp/tools/wk/shot.py file:///home/claude/wk/game.html 812 375 steps.json
```
`steps.json` = lista de `[atraso_ms, js, caminho_png_ou_null]`; `'w'` só captura. Ganchos úteis em `window.__rdp`: `setQuality('high')`, `prog()` (save), `startQuick()`, `god()`, `tp(x,z)`/`tpy(x,z,y)`, `look(yaw,pitch)`, `spawnRole('medio'|'defesa'|'ponta'|'extremo'|…)`, `enemiesRaw()`, `step(dt,n)`, `dbg()`, `openMap({})`, `thumbs()`. `window.__rdpFreeze=true` congela o jogo para a captura. Exemplos: `tools/wk/steps_arranque.json` (primeiro arranque servido: precisa de `python3 -m http.server 8766` numa pasta com `Pistoleiro.1/` = `dist/*`), `steps_inimigos_perto.json`.
O node não carrega GLTF (usa cápsulas): a personagem só se valida no WebKit.

## 7. Publicar
1. `npx vite build`; copiar `dist/*` para a raiz do ramo `main` do repositório com `.nojekyll`; commit; push com a chave que o Gabriel fornece (fine-grained PAT, só para o repo; usar `-c http.extraHeader="Authorization: Basic $(printf 'x-access-token:%s' "$TOKEN" | base64 -w0)"`, apagar a chave do disco no fim). A chave usada nesta sessão foi apagada e **não deve ser reutilizada**: pedir uma nova.
2. Esperar pelo build do Pages (`/repos/gabintrigo/Pistoleiro.1/pages/builds/latest`); se ficar "building" mais de 5 min, fazer um commit trivial (`version.txt`) para destravar.
3. Atualizar também o ramo `source` (código) e os zips em `/mnt/user-data/outputs/` (`regresso-do-pistoleiro.html`, `publicar-pistoleiro.zip`, `regresso-pistoleiro-projeto.zip`).
4. O Gabriel testa no iPhone e manda prints (2436×1125 = 812×375 pontos).

## 8. Regras que o Gabriel definiu
- Fazer tudo o que for possível sem assets externos; ele trata do que é externo (mesmo pago) seguindo instruções passo a passo sem exigir capacidade técnica; ficheiros até ~30 MB cabem na conversa, maiores descomprime e envia só o necessário (ou print da pasta).
- Não usar emojis na UI; seguir os exemplos CoD Mobile/Combat Master; a personagem de menu só volta quando "aguentar a comparação".
- Sniper: adversário deve acertar; a do jogador só com mira. Caçadeira útil a 5–12 m.
- Testar tudo antes de publicar; ele fecha e reabre a app para apanhar a versão nova (cache `rdp-*`, sw-cleanup).

## 9. Sessão de 27 set 2026 (máquina do Gabriel, macOS)

Feito nesta sessão, tudo na árvore de trabalho e **por publicar**.

**Fronteiras do equipamento (ponto 1 — resolvido).** Eram três causas, não uma: `ual_body.mjs` gravava pesos
contínuos em `COLOR_0`; o shader somava as três cores (`uShirt*r+uShorts*g+uSocks*b`), fundindo vermelho com azul;
e a cintura era decidida por *identidade de osso* (`Hips`/`Spine`), logo nunca podia ser uma linha reta. Agora:
one-hot por vértice, `smoothstep` a endurecer os pesos no shader (banda de 0.06 = antialiasing), e cortes
**geométricos** afináveis no topo do `ual_body.mjs`: `CUT={hem:+0.02, sleeve:0.55, shorts:0.62}`.

**Penteados (ponto 2 — feito).** glTFs em `assets/src/quaternius/ubc/hair/` (840 KB, referências a texturas
removidas de propósito: reaproveitam o material de cabelo do corpo, macho T_Hair_1 / fêmea T_Hair_2).
`ual_body.mjs` funde-os e religa o skin ao esqueleto do corpo. Macho: `Hair_Buzzed`, `Hair_SimpleParted`,
`Hair_Beard`. Fêmea: `Hair_Long`, `Hair_Buns`. Lista em `meta.hairStyles`; no jogo `CharacterInstance.setHair(corte, barba)`,
escolhido em `dressEnemy` a partir dos cortes que **aquele** corpo tem. O careca fica em minoria.
Só vieram 6 penteados + barba no pacote Standard (o handoff dizia 20) e não há corpos Regular/Teen.

**ARMADILHA — nomes de osso repetidos.** Fundir um penteado traz a armadura completa de 65 ossos. Com nomes
repetidos o GLTFLoader desambigua (`LeftArm` -> `LeftArm_1`), os canais de animação deixam de encontrar os ossos
e **os braços ficam presos em T**. O `ual_body.mjs` descarta agora os 66 nós duplicados por penteado. Se algum dia
os braços voltarem a ficar em T, confirmar primeiro: nós do GLB devem ser ~72 e **zero** nomes repetidos.

**Número nas costas (ponto 3 — feito).** Estava 0,5×0,56 m a flutuar 0,19 m atrás da coluna. Agora o tamanho e o
recuo saem do esqueleto (`torso=Neck.y-Spine.y`; largura `torso*0.62`, recuo `torso*0.385`). O emblema opcional não foi feito.

**Variedade (ponto 4 — feito em parte).** `CharacterPool` aceita uma lista de templates: 16 instâncias com
3 machos para cada fêmea; `acquire('ubc_male')` para o modelo do jogador. `TEAMS` passa a poder definir `skins` e
`hairs` — o mecanismo está lá, **os valores por seleção não foram preenchidos** (é uma decisão tua, não minha).
As texturas de pele *Light* existem agora em `ubc/` mas continuam por integrar: o tom ainda é um multiplicador em `setKit`.

**Personagem do lobby (ponto 5 — feito, a precisar do teu veredicto).** Volta a aparecer, à direita da montra da
arma: `MENU_CHAR={x:1.60,z:-2.90,yaw:Math.PI*0.82}` no `Game.js`, afinável em execução com `__rdp.menuChar(x,z,yaw)`.
Faz `celebrate` de 11 a 18 em 18 segundos e regressa ao idle. Tu é que decides se "aguenta a comparação".

**Equipamentos (ponto 6 — corrigido).** Os offsets do `setGear` estavam em espaço do OSSO, calibrados para o rig
antigo; no rig da Quaternius os ossos apontam noutra direção e o colete ia parar à cara. As 7 peças ancoram agora
em pontos medidos no esqueleto em repouso (`anchor()` em `Character.js`), com opção de seguir a direção do membro.

**Desempenho (ponto 7 — feito).** `ual_body.mjs` gera `<nome>_lod1.glb` (simplify a 45%, sem animações nem
texturas — o LOD usa o material da instância): macho 17 483 -> 8 739 triângulos (370 KB), fêmea 21 250 -> 10 174 (386 KB).
`setHair` percorre os LODs todos, para o corte não trocar ao longe.

**Capturas em macOS.** O `tools/wk/shot.py` precisa de xvfb (só Linux). Substituto: **`tools/wk/shot_mac.mjs`**,
que fala CDP com um Chrome headless e lê os mesmos `steps.json`. Sem dependências novas.
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9222 \
  --user-data-dir=/tmp/rdp-chrome --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader about:blank &
(cd dist && python3 -m http.server 8766 &)
DPR=3 node tools/wk/shot_mac.mjs http://127.0.0.1:8766/ 812 375 steps.json     # DPR=3 -> 2436x1125
```
Notas de macOS: não há `timeout` (é `gtimeout`); o Node instalado é o v26 em `/usr/local/bin`.

**Por fazer:** UAL2 (os 2 ficheiros continuam por enviar — não estão nas Descargas), sons, ícones Kenney, música,
tons de pele por seleção, emblema. **Nada disto foi publicado**; é preciso uma chave nova.
