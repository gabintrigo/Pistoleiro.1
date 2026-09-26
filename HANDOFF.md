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
- **Personagem NOVA (ponto 1 do plano de assets):** `CHAR_ASSET='ual_mannequin'` em `initCharacters` (Game.js). Esqueleto Quaternius de 65 ossos renomeado para a convenção do código (Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder/Arm/ForeArm/Hand, RightShoulder/Arm/ForeArm/Hand, LeftUpLeg/Leg/Foot/ToeBase, RightUpLeg/…), 37 clips separados pernas/tronco, corpo provisório = manequim, cores planas por seleção (`dressEnemy`: `tm.shirt`, guarda-redes `tm.gk.shirt`, tom de pele por `o.skin`). A personagem antiga (`human_base`, MakeHuman + Mixamo) continua no manifesto como reserva: basta mudar `CHAR_ASSET`.

## 3. Ficheiros e ferramentas importantes
| Ficheiro | Para quê |
|---|---|
| `src/game/Game.js` | quase toda a lógica (modos, IA, HUD, loja, menus). Funções-chave: `initCharacters`, `dressEnemy`, `placeMenuModel`/`menuThumbs`/`renderSceneThumb`, `renderWeaponIcons`, `refreshMenu`, `enemyFire`, `updateEnemy`, `tdmStart`, `startGame`, `openMenuShop`/`closeShop` |
| `src/characters/Character.js` | `CharacterTemplate`/`CharacterInstance`: clips LOWER/UPPER/ONESHOT/FULL, `setColors` (modo `flat`), `_autoRifle` (orientação da arma a partir da pose `aim`), `setGear`, LODs, hitboxes |
| `src/game/Data.js` | seleções (`TEAMS`: shirt/shorts/socks/gk/traits/scout…), armas (`WEAPONS`, falloff/spread/range), `WSTAGE`, economia |
| `src/assets/manifest.json` + `AssetRegistry.js` | `registry.character(name)` lê `characters[name]`; `meta.flatKit` ativa cores planas |
| `index.html` | todo o CSS (várias secções acrescentadas no fim; a última ganha) |
| `tools/ual_pack.mjs` | empacota animações da UAL (só as úteis, sem dedos, meshopt) |
| `tools/ual_character.mjs` | **constrói `public/assets/characters/ual_mannequin.glb`** a partir de `assets/src/quaternius/ual/UAL1.glb` e escreve a entrada do manifesto. `MAP` = nome no jogo → [clip origem, lower/upper/full] |
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
- **Texturas em falta neste envio** (ver `ubc/PLACEHOLDERS.txt`): `T_Eye_Brown.png`, `T_Eye_Normal_png.png`, `T_Superhero_Male_Normal.png`, `T_Superhero_Male_Dark.png` — estão substituídas por marcadores; pedir ao Gabriel que as volte a enviar do zip (pasta glTF do Universal Base Characters[Standard]). Não são bloqueantes.
- Ainda não integrados: UAL2 (parkour/combos; Gabriel disse ter 2 ficheiros para enviar), texturas dos tons de pele restantes, penteados extra (20 no pacote; só 2 vieram).

## 5. PRÓXIMO PASSO (onde ficámos): corpos reais em vez do manequim
Objetivo: inimigos, colegas e personagem de menu com cara e cabelo, vestidos com o equipamento de cada seleção.
1. Novo script `tools/ubc_character.mjs` (copiar a estrutura de `ual_character.mjs`): ler `Superhero_Male_FullBody.gltf`, renomear ossos com o mesmo `RENAME`, **copiar para ele os 37 clips** já preparados (mesmo rig → os samplers podem ser copiados clip a clip a partir de `UAL1.glb` com o `MAP`), remover pistas dos dedos, meshopt → `public/assets/characters/ubc_male.glb` (+ `ubc_female.glb`). Manter os materiais originais renomeados: corpo → `kit` (classe `Kit`), olhos → `eyes`, cabelo → `hair` (classe `Hair`; `meshClass` em Character.js já reconhece `/hair/`).
2. **Pintar os equipamentos no corpo por pesos dos ossos** (não há pacote de roupa de futebol): para cada vértice, região = camisola (Spine*, Shoulder, Arm, ForeArm), calções (UpLeg, Hips), meias (Leg), botas (Foot/ToeBase), pele (Head, Neck, Hand). Rasterizar as regiões no espaço UV do corpo (triângulo a triângulo, como um mapa de IDs) → gerar uma textura de equipamento por seleção (cores `shirt/shorts/socks/trim`, número nas costas a partir de `numberTex`) por cima da textura de pele (`T_Superhero_Male_*`). Fazer em runtime numa `CanvasTexture` (uma por seleção, cache) ou pré-calcular a máscara UV uma vez (script node) e guardá-la como PNG pequeno.
3. Ligar no jogo: `CHAR_ASSET='ubc_male'`, `meta.flatKit=false`, `dressEnemy` volta a usar `setColors(skin,kitTex,hair)` com a textura gerada; guarda-redes com cores `tm.gk`; colegas com o kit dos Leões (vermelho `0xd8202a`); mulher nos extremos/alguns papéis para variedade.
4. Verificar: capacete/colete/números (`setGear` usa Head/Spine2/LeftLeg/RightLeg/LeftArm/RightArm — ajustar offsets se ficarem desalinhados), `headCenter/headRadius` (cabeça a ~1,6 m), `_autoRifle`, LOD (13 k tris × 16 inimigos: aceitável no iPhone 17 Pro Max; se precisar, decimar para LOD1 com gltf-transform `simplify`).
5. Personagem de menu: voltar a mostrar `pmodel` no lobby (hoje escondido; `placeMenuModel`) com `Celebration`/`Idle_LookAround_Loop`, ao lado da montra da arma ou em vez dela.
6. Depois: sons (Sonniss GDC 2026 + Kenney, o Gabriel descarrega e escolhe ~60), ícones Kenney CC0 nos separadores, música Pixabay, UAL2. Opcional pago: Synty Battle Royale (49,99 $) para props/cenário.

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
