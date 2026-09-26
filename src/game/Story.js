/* Regresso do Pistoleiro — texto narrativo (sátira do futebol). Tudo fictício: liga, dirigentes, capitães. PT-PT. */
export const PRESIDENT='Bartolomeu Nabo';
export const LEAGUE='Confederação de Futebol Total';
export const PAPER='O Apito Final';
export const HERO={ilha:'Ilha do Corvo Negro',clube:'Leões da Capital',taca:'Taça das Nações',golos:'873'};
export const PROLOGUE=[
 {postcard:'ilha',title:'O MIÚDO DA ILHA',sub:'Onde tudo começou',body:'Nasceste na Ilha do Corvo Negro, no meio do Atlântico. Aos doze anos apanhaste o barco para a capital com uma mala e uma bola. Tornaste-te o maior goleador de sempre: 873 golos.'},
 {title:'O REGRESSO DO PISTOLEIRO',sub:'O futebol morreu. Tu não.',body:'O presidente Nabo baniu a bola, comprou os capitães e baniu-te a ti por recusares falhar um penálti. Vence as cinco seleções, chega ao iate dele e prova tudo. Foste o maior goleador; agora vais ser o maior pistoleiro.',model:{who:'player',pose:'aim'}}
];
export const EPILOGUE=[
 {title:'CAMPEÃO OUTRA VEZ',sub:'Do relvado à arena, o mesmo resultado',body:'Ganhaste tudo o que havia para ganhar com bola. Agora ganhaste tudo o que havia para ganhar sem ela. O Nabo sobe ao palco para entregar a Taça, sorri para as câmaras e desaparece pela porta de serviço. Encontraram-no num jato privado com 40 milhões em relva.',model:{who:'player',pose:'idle'}},
 {title:'PROLONGAMENTO',sub:'O regulamento não previa isto',body:'Sem presidente, a liga entra em prolongamento indefinido. As seleções continuam a chegar; a claque continua a pagar. Aguenta o máximo que conseguires. O miúdo da ilha nunca soube parar.',model:{who:'player',pose:'aim'}}
];
export const CAPTAINS={
 esp:{nome:'El Toro',alcunha:'O Penteado',bio:'Capitão de Espanha, obcecado com a madeixa e com as selfies. Perdeu a Bota de Ouro para ti três anos seguidos e ainda diz que foi o cabelo que o distraiu.',
  intro:['O miúdo da ilha! Vieste ver de perto? Não toques no cabelo.','O gel é caro. As balas são de graça.'],
  taunts:['Isto não é golpe, é gel!','Os meus patrocinadores pagam por cada tiro que falhas.','Sorri para a câmara, que é a última.','Já viste a minha estátua? Também não. Ainda.'],
  hurt:['Cuidado com a cara, é património!','Isso deixa marca!'],phase2:'Reforços! E tragam o espelho.',phase3:'ARRUINASTE A MADEIXA!',death:'Diz ao Nabo... que o cabelo foi de graça.'},
 fra:{nome:'Le Coq',alcunha:'O Filósofo',bio:'Capitão de França. Cita-se a si próprio e ainda contesta a final da Taça das Nações que lhe ganhaste: «foi o vento da ilha», escreveu no seu livro.',
  intro:['Chegas atrasado, como a justiça.','Vou eliminar-te com elegância. É a única forma.'],
  taunts:['O árbitro é meu primo. E o VAR, meu sobrinho.','Falhar é uma forma de existir. Tu existes muito.','Isto é arte. Tu és vandalismo.','Cito-me a mim próprio: «vou ganhar».'],
  hurt:['Mão! Foi mão!','Isto vai para a minha autobiografia.'],phase2:'Apelo às instâncias! Quer dizer, aos meus amigos.',phase3:'Sem árbitro, sem regras, sem misericórdia.',death:'Pelo menos... morro de fato.'},
 ale:{nome:'Der Adler',alcunha:'O Processo',bio:'Capitão da Alemanha. Tem uma pasta com todos os teus 873 golos catalogados por erro defensivo. Nunca encontrou o erro. Isso irrita-o.',
  intro:['Chegaste às 20:04. O jogo era às 20:00. Ponto negativo.','Segundo o protocolo, já perdeste.'],
  taunts:['Está tudo no regulamento, artigo 7.','A tua eliminação está agendada para daqui a 40 segundos.','Eficiência: 100 %. Tu: 0.','Isto não foi discutido em reunião.'],
  hurt:['Isso não estava no plano.','Vou registar isso na ata.'],phase2:'Ativar plano B. Há sempre um plano B.',phase3:'PLANO Z. NÃO HÁ PLANO Z.',death:'O relatório... vai ficar por fazer.'},
 bra:{nome:'O Jaguar',alcunha:'O Showman',bio:'Capitão do Brasil. Dribla sem bola, comemora antes de marcar e jura que o miúdo da ilha aprendeu tudo a ver os vídeos dele. Os vídeos são de 2019.',
  intro:['Dança comigo, meu. Depois te elimino com estilo.','Galera, faz barulho! Chegou o Pistoleiro!'],
  taunts:['Isso foi um drible. Sem bola, mas foi.','Meu patrocinador de energético manda um abraço.','Golaço! Ah, era tiro. Também vale.','Sorri, que a torcida tá filmando.'],
  hurt:['Ei, isso é falta!','Meu cabelo não, meu!'],phase2:'Galera, faz barulho! Reforço na área!',phase3:'Agora é samba de verdade.',death:'Falem bem de mim... nas redes.'},
 arg:{nome:'El Cóndor',alcunha:'O Presidente Adjunto',bio:'Capitão da Argentina e braço direito do Nabo. Foi ele que assinou o teu banimento. Diz que foi por «conduta antidesportiva»; a conduta foi marcares o penálti.',
  intro:['O Nabo manda cumprimentos. E o teu banimento, emoldurado.','Marcaste 873 golos. Aqui só conta o último tiro.'],
  taunts:['Comprei este estádio. E o árbitro. E o teu banco.','Chora, que o VAR é meu.','Isto é negócio, não é futebol.','Tenho um envelope com o teu nome.'],
  hurt:['Isso vai para o relatório!','Sabes quanto custa este fato?'],phase2:'Segurança! Tirem-no daqui... com balas.',phase3:'SE EU CAIO, O NABO CAI. NINGUÉM CAI!',death:'O Nabo... vai negar tudo.'},
 ita:{nome:'Il Catenaccio',alcunha:'O Ferrolho',bio:'Capitão de Itália. Vinte anos sem sofrer golos, porque nunca saiu da própria área. Traz escudos, tem escudos, é um escudo.',
  intro:['Não entras. Ninguém entra. É a regra da casa.','Ataca à vontade; eu tenho o dia todo.'],
  taunts:['Zero golos sofridos. Zero balas também.','O meu defesa tem um defesa.','Isto chama-se organização. Tu chamas-lhe aborrecimento.','Espera sentado; eu espero deitado.'],
  hurt:['Não é nada. É o escudo a queixar-se.','Recuar! Mais!'],phase2:'Linha de cinco! Linha de seis! Todos!',phase3:'Fecha-se a porta. E a janela. E o telhado.',death:'Deixaram... passar um.'},
 eng:{nome:'Sir Longball',alcunha:'O Lorde',bio:'Capitão de Inglaterra. Pede desculpa antes de disparar, bebe chá ao intervalo e tem atiradores em todos os terraços, «por tradição».',
  intro:['Peço desculpa pelo que se segue. Não é pessoal, é histórico.','Chove. Ótimo. É o nosso tempo.'],
  taunts:['Terrivelmente indelicado da tua parte continuares vivo.','O chá arrefece; despacha-te a cair.','Bola longa! Quer dizer, tiro longo.','Isto foi inventado por nós, sabes?'],
  hurt:['Que falta de modos.','Tomo nota. Com tinta.'],phase2:'Cavalheiros, aos terraços!',phase3:'Acabou o chá. Acabou a cortesia.',death:'Sem... ressentimentos.'},
 ned:{nome:'O Totaal',alcunha:'O Total',bio:'Capitão dos Países Baixos. Joga em todas as posições ao mesmo tempo e chega ao estádio de bicicleta. A equipa dele nunca para.',
  intro:['Corre, corre, corre! Nós também.','Toda a gente para todo o lado. Tu ficas aí.'],
  taunts:['Estás parado. É um erro tático.','Já viste os meus laterais? Estão atrás de ti.','Futebol total: total mesmo.','A bicicleta chega antes de ti.'],
  hurt:['Rotação! Rodem!','Isso foi um lateral.'],phase2:'Linha alta! Ninguém defende, todos atacam!',phase3:'Pressão total. Sem travões.',death:'Pelo menos... corri.'},
 uru:{nome:'La Garra',alcunha:'A Garra',bio:'Capitão do Uruguai. Nunca desistiu de nada, incluindo de discussões perdidas. Vem sempre acompanhado e o guarda-redes também ataca.',
  intro:['Aqui não se desiste. Nem eles, nem eu, nem tu.','Vamos todos. Até o guarda-redes.'],
  taunts:['Garra! Não é técnica, é vontade.','Cai que a gente levanta-te. Para cair outra vez.','Isto é o nosso quintal.','Ninguém sai daqui sem jogar.'],
  hurt:['Isso dá força!','Mais! Ainda estou de pé!'],phase2:'Todos para a frente! O guarda-redes também!',phase3:'Última garra. A que dói.',death:'Não... desisti.'},
 cft:{nome:'Presidente Nabo',alcunha:'O Presidente',bio:'Presidente vitalício da CFT. Baniu a bola, inventou a liga dos tiros e nunca explicou os 40 milhões do relvado. Joga rodeado de seguranças e de envelopes.',
  intro:['Bem-vindo ao meu iate. Tudo o que vês foi pago pelo futebol. Quer dizer, por ti.','Tens 873 golos. Eu tenho 873 advogados.'],
  taunts:['Isto não é corrupção, é gestão.','Cada bala tua é uma receita minha.','O VAR sou eu. Sempre fui.','Sorri, que isto é pay-per-view.'],
  hurt:['O fato! O fato é italiano!','Seguranças! Façam o vosso trabalho!'],phase2:'Seguranças ao convés! Paguem-lhes a dobrar!',phase3:'Se eu cair, levo a bola comigo!',death:'Isto... não estava no orçamento.'},
 jpn:{nome:'O Samurai',alcunha:'O Preciso',bio:'Capitão do Japão. Conta as balas, conta os passos, conta os teus erros. Nunca desperdiça um tiro e nunca chega tarde.',
  intro:['Cada bala tem um nome. A minha tem o teu.','Disciplina. É tudo o que te falta.'],
  taunts:['Falhaste. Eu não falho.','Vinte e três tiros gastos. Eu usei quatro.','Silêncio é precisão.','Treina. Depois volta.'],
  hurt:['Erro registado.','Recalcular.'],phase2:'Formação. Atiradores em posição.',phase3:'Modo final: um tiro, uma queda.',death:'Cálculo... incompleto.'}
};
export const ANNOUNCER={
 wave:['Onda {n}! O público quer sangue. Quer dizer, golos. Quer dizer, sangue.','Onda {n}. Os dirigentes já contaram o dinheiro dos bilhetes.','Onda {n}! Lembramos que o relvado custou 40 milhões. Não o sujem.','Onda {n}. A '+LEAGUE+' informa que qualquer semelhança com futebol é coincidência.','Onda {n}. O árbitro está no bar. Continuem.'],
 clear:['Onda limpa! Alguém avise o Nabo que isto não estava no guião.','Fim da onda. O VAR está a rever se foi legal. Não foi.','Pausa técnica. A loja está aberta: preços justos, disse o dono da loja.','Onda concluída. Nos camarotes, ninguém aplaude.'],
 boss:['Entra o capitão {b}! A claque pagou para vaiar.','{b} em campo. O contrato de imagem exige plano fechado.','Capitão {b}! Dizem que veio de jato. O jato é do Nabo.'],
 streak:['{n} seguidos! O comentador engasgou-se com a sandes.','{n}! Alguém chame o VAR, isto não pode ser legal.','{n} seguidos. O Nabo pediu para não filmarem.'],
 head:['Na cabeça! E dizem que o futebol se joga com os pés.','Cabeceamento perfeito. Ao contrário.'],
 death:['E o Pistoleiro cai. Nos camarotes, brindam.','Fim da linha. O Nabo já mandou apagar as câmaras.','Cai o Pistoleiro. O relatório oficial dirá «lesão».'],
 lowhp:['Vida baixa! O médico da equipa foi despedido por cortes.','O Pistoleiro sangra. O patrocinador de água pede plano fechado.'],
 mod:['A '+LEAGUE+' decreta: {m}. Recurso indeferido.','Nova regra em vigor: {m}. Ninguém votou, mas passou.'],
 obj:['Missão especial: {o}. Os dirigentes apostaram contra ti.','Objetivo: {o}. Prémio pago em dinheiro vivo, como sempre.'],
 evt:['Aviso do estádio: {e}. Não é culpa da organização, disse a organização.','{e}! A manutenção foi subcontratada ao cunhado do Nabo.'],
 shop:['A loja abriu. Preços tabelados pela CFT, ou seja, inventados.']
};
export const HEADLINES={
 win:[
  {h:'O MIÚDO DA ILHA VOLTA A GANHAR EM {est}',s:'{b} pede repetição do jogo; a CFT responde que os jogos não se repetem, «só as faturas».'},
  {h:'{p} FAZ {kills} EM {team}: «DO RELVADO À ARENA, O MESMO RESULTADO»',s:'Nabo: «Não conheço esse senhor. Nunca conheci. Quem?»'},
  {h:'{team} SEM CAPITÃO: {b} ENCONTRADO A CHORAR NO TÚNEL',s:'Adeptos dos Leões da Capital abrem champanhe; adeptos dos dirigentes abrem inquérito.'},
  {h:'RECORDISTA DE GOLOS É AGORA RECORDISTA DE ONDAS: {p} LIMPA {est}',s:'Segundo a CFT, «a onda foi ganha com bola», o que não explica os {head} tiros na cabeça.'},
  {h:'{p} HUMILHA {team}: {kills} ELIMINAÇÕES E {b} A CHORAR PARA O ÁRBITRO',s:'Presidente Nabo: «Foi um jogo normal. Não há investigação. Não há nada.»'},
  {h:'{team} CAI EM CASA. {b} CULPA O RELVADO, O VENTO E O PISTOLEIRO',s:'Claque exige reembolso; CFT responde com um comunicado de três linhas e nenhum verbo.'},
  {h:'{head} NA CABEÇA: {p} DÁ AULA DE CABECEAMENTO EM {est}',s:'Federação médica pede «calma». Nabo pede «silêncio».'}
 ],
 over:[
  {h:'O MIÚDO DA ILHA CAI EM {est}. {b} DEDICA A VITÓRIA AO NABO',s:'Nabo dedica-a a si próprio. A claque dedica-lhe um cântico que não podemos publicar.'},
  {h:'{p} ELIMINADO NA ONDA {w}: «ATÉ OS MELHORES TÊM DIAS DE VAR»',s:'A CFT emite comunicado de duas linhas. A segunda linha é a assinatura.'},
  {h:'{team} ELIMINA {p} NA ONDA {w}',s:'Nabo festeja com champanhe pago pelo relvado sintético.'},
  {h:'O PISTOLEIRO FICA PELO CAMINHO EM {est}',s:'Relatório oficial: «lesão». Testemunhas: «foram {kills} eliminações antes disso».'}
 ],
 champion:[{h:'{p} CAMPEÃO: NABO DESAPARECE COM O TROFÉU',s:'Encontrado num jato privado com 40 milhões em relva. Diz que era para o jardim.'}]
};
/* rádio entre ondas: dois comentadores da «Rádio Balneário» + convidados */
export const RADIO=[
 [['Zé Apito','Pausa na arena. Quem está a ver isto em casa, muda de canal, que o Nabo cobra por minuto.'],['Dra. Contas','Não cobra, Zé. Já está pago. Pelo relvado.']],
 [['Zé Apito','{p} com {kills} eliminações. Nos tempos da bola dizia-se golos.'],['Dra. Contas','Nos tempos da bola havia futebol, Zé.']],
 [['Porta-voz do Nabo','A Confederação nega qualquer irregularidade nesta onda.'],['Zé Apito','Ninguém perguntou.'],['Porta-voz do Nabo','Nega na mesma.']],
 [['Dra. Contas','Sabiam que o miúdo da ilha saiu de casa aos doze para jogar pelos Leões da Capital?'],['Zé Apito','Sei. E o Nabo saiu com os 40 milhões aos cinquenta.']],
 [['Zé Apito','O capitão {b} garante que ganha esta. Já dizia isso na Taça das Nações.'],['Dra. Contas','Perdeu 3-0, Zé.']],
 [['Treinador do banco','Vamos analisar a onda em vídeo.'],['Zé Apito','O vídeo foi apagado pela CFT.'],['Treinador do banco','Então vamos analisar de memória.']],
 [['Zé Apito','A loja está aberta. Preços da CFT.'],['Dra. Contas','Ou seja, o dono da loja é primo de alguém.']],
 [['Dra. Contas','Onda {n} a chegar. Recomendo colete.'],['Zé Apito','Recomendo o outro canal.']]
];
export const CHANTS=[
 'NA-BO, NA-BO, DEVOLVE O RELVADO!','ILHA! ILHA! ILHA!','O MIÚDO DA ILHA VOLTOU!','{p}! {p}! {p}!','QUEM NÃO SALTA É DIRIGENTE!','873! 873! 873!','O ÁRBITRO É DO NABO!','PISTOLEIRO, MARCA-LHE UM!'
];
/* postais de chegada (ilustração animada em Scenes.js + título e uma linha de sátira) */
export const POSTCARDS={
 ilha:{title:'ILHA DO CORVO NEGRO',line:'Onde o vento é o único treinador que não cobra.'},
 esp:{title:'BEM-VINDO A SEVILHA',line:'Quarenta graus à sombra. El Toro trouxe três secadores de cabelo e nenhum plano.'},
 fra:{title:'BEM-VINDO A PARIS',line:'A Torre Eiffel tem 330 metros. O ego do Le Coq tem mais.'},
 ale:{title:'BEM-VINDO A BERLIM',line:'O jogo começa às 20:00:00. Nem um segundo depois, diz o Der Adler.'},
 bra:{title:'BEM-VINDO AO RIO',line:'O Cristo tem os braços abertos. A defesa do Jaguar também.'},
 arg:{title:'BEM-VINDO A BUENOS AIRES',line:'O Obelisco foi pago pela CFT. Duas vezes. Em envelope.'},
 ita:{title:'BEM-VINDO A PISA',line:'A torre inclina-se desde o século XII. A Itália defende desde então.'},
 eng:{title:'BEM-VINDO A LONDRES',line:'Chove. Sir Longball diz que é tradição; o Big Ben diz que são horas.'},
 ned:{title:'BEM-VINDO A AMESTERDÃO',line:'Moinhos, tulipas e onze jogadores a pedalar para todo o lado.'},
 uru:{title:'BEM-VINDO A MONTEVIDEU',line:'O Centenário viu a primeira final de um Mundial. Hoje vê-te a ti.'},
 cft:{title:'O IATE DO NABO',line:'Um estádio no convés, champanhe na tribuna e 40 milhões em relva debaixo do tapete.'},
 jpn:{title:'BEM-VINDO AO JAPÃO',line:'O Fuji é pontual, o comboio é pontual. O Samurai também.'}
};
export function fill(t,v){return t.replace(/\{(\w+)\}/g,(m,k)=>v[k]!==undefined?String(v[k]):m);}
/* escolhe uma frase sem repetir nenhuma das últimas 3 da mesma lista */
const _recent=new Map();
export const pickLine=a=>{ if(!a||!a.length)return ''; const rec=_recent.get(a)||[]; const pool=a.filter(x=>!rec.includes(x)); const c=(pool.length?pool:a)[Math.floor(Math.random()*(pool.length?pool.length:a.length))]; rec.push(c); if(rec.length>Math.min(3,a.length-1))rec.shift(); _recent.set(a,rec); return c; };
/* ---- túnel: resposta do herói (humilde / provocador) e reação do capitão ---- */
export const TUNNEL={
 esp:{humble:['Que ganhe o melhor, Toro. Como nos velhos tempos.','Os velhos tempos em que me roubaste três Botas de Ouro? Hoje não há bota que te salve.'],cocky:['Trouxe três Botas de Ouro na mala. Queres uma emprestada?','Isso foi baixo. Hoje é pessoal, miúdo da ilha.']},
 fra:{humble:['Aquela final foi dura para os dois.','Dura? Foi uma injustiça histórica. Escrevi quatrocentas páginas sobre isso.'],cocky:['Ainda tenho a medalha da final. Queres ver?','Mostra-a ao árbitro. Ah, espera: é meu primo.']},
 ale:{humble:['Os teus números estão certos. Os meus golos também.','Correto. Por isso é que isto é um problema estatístico.'],cocky:['Já contaste até 873? Hoje vais contar abates.','Anotado. Tom insolente, item 874.']},
 bra:{humble:['Vi os teus vídeos, Jaguar. Mas o drible é meu.','É nosso, meu! Mas o golo hoje é meu.'],cocky:['Ensinaste-me tudo? Então ensina-te a perder.','Eita! Agora ficou sério. Galera, silêncio!']},
 arg:{humble:['Só quero a minha licença de volta.','A tua licença está num cofre. O código é a tua derrota.'],cocky:['Assinaste o meu banimento. Hoje assino o teu.','Com que caneta? A de ouro é minha.']},
 ita:{humble:['Respeito a vossa defesa. É uma obra de arte.','Arte que ninguém atravessa. Nem tu.'],cocky:['Vinte anos sem sofrer golos. Hoje acaba.','Então passa por onze escudos. Boa sorte.']},
 eng:{humble:['Boa tarde, Sir. Que vença o mais educado.','Que simpático. Vou disparar com imensa pena.'],cocky:['Chá frio e atiradores lentos. Tradição inglesa?','Que ordinário. Cavalheiros, aos terraços.']},
 ned:{humble:['Corram à vontade. Eu espero.','Esperar é bom. Chegamos todos ao mesmo tempo.'],cocky:['Futebol total? Eu jogo tiro total.','Então vamos ver quem cansa primeiro.']},
 uru:{humble:['Respeito a vossa garra.','Respeito não chega. Aqui é preciso suar sangue.'],cocky:['Garra? Eu trouxe pontaria.','A pontaria acaba com as balas. A garra não acaba.']},
 jpn:{humble:['Um tiro, uma queda. Aceito as regras.','Aceitar é o primeiro passo. O segundo é cair.'],cocky:['Contas as balas? Conta estas.','Contadas: vinte e três desperdícios anunciados.']},
 cft:{humble:['Só quero a bola de volta, presidente.','A bola está no meu cofre, ao lado do teu contrato. Paga para ver.'],cocky:['Hoje o VAR sou eu, Nabo.','Seguranças! Tragam o meu advogado. E as metralhadoras.']}
};
/* ---- capítulos: memória do herói e pista deixada pelo capitão derrotado ---- */
export const CHAPTERS={
 esp:{n:1,title:'Os Leões da Capital',memory:'Doze anos, uma mala e um bilhete só de ida. Chegaste à capital a chorar de saudade da ilha e a marcar golos a toda a gente. Os Leões da Capital deram-te a camisola; o El Toro, na academia rival, deu-te a primeira rivalidade.',clue:'O Nabo paga-nos com envelopes da Taça das Nações. Pergunta ao Le Coq quem os entregou em Paris.'},
 fra:{n:2,title:'A final da Taça das Nações',memory:'A final em Paris. A perder 1-0 aos oitenta minutos, com um tornozelo do tamanho de uma laranja. Marcaste dois. O país inteiro saiu à rua; o Le Coq ainda hoje escreve cartas ao árbitro.',clue:'Os envelopes vinham de Berlim. O Der Adler guarda os recibos. Ele guarda tudo.'},
 ale:{n:3,title:'Oitocentos e setenta e três',memory:'O golo 873 foi de calcanhar, num dia de chuva, contra ninguém em especial. Ninguém sabia que seria o último: na semana seguinte a CFT baniu a bola.',clue:'Os recibos dizem «relvado sintético». Foram pagos a uma empresa do Rio. Procura o Jaguar.'},
 bra:{n:4,title:'O drible sem bola',memory:'A primeira vez que jogaste no Rio tinhas dezoito anos e fizeste um drible tão bom que o defesa pediu um autógrafo. O Jaguar estava na bancada. Diz que foi ele que te ensinou. Não foi.',clue:'A empresa do relvado é do El Cóndor. Assinou o teu banimento com a mesma caneta.'},
 arg:{n:5,title:'O penálti que não falhei',memory:'Pediram-te para falhar um penálti. Um envelope, um sorriso, um presidente. Marcaste ao ângulo. No dia seguinte eras «conduta antidesportiva».',clue:'Queres o Nabo? Está no iate, no Mediterrâneo. Mas sem provas nem o VAR te dá razão.'},
 cft:{n:6,title:'A bola',memory:'',clue:''}
};
/* ---- provas escondidas nos jogos extra ---- */
export const EVIDENCE={
 ita:{nome:'O contrato do relvado',desc:'Quarenta milhões por um relvado que nunca saiu do armazém. Assinado a lápis, para poder ser apagado.'},
 eng:{nome:'As atas da reunião secreta',desc:'Chá, bolachas e a decisão de banir a bola, registadas por um secretário demasiado educado para mentir.'},
 ned:{nome:'Os bilhetes do jato',desc:'Cinco voos privados do Nabo para cinco capitães, sempre na véspera dos jogos.'},
 uru:{nome:'A caneta de ouro',desc:'A caneta com que o teu banimento foi assinado. Ainda tem tinta e as iniciais B. N.'},
 jpn:{nome:'A gravação do penálti',desc:'O vídeo original do penálti, sem cortes: o Nabo a fazer sinal ao árbitro.'}
};
/* ---- finais ---- */
export const ENDINGS={
 partial:{h:'NABO FOGE DE HELICÓPTERO COM A TAÇA',s:'Tribunal: «sem provas não há crime». O Nabo acena do ar e deixa cair um envelope vazio.',body:'O presidente caiu no convés mas levantou-se a tempo de apanhar o helicóptero. Sem provas, ninguém o pode prender. Diz quem viu que ainda gritou «volto no pay-per-view».'},
 true:{h:'O APITO FINAL PUBLICA AS PROVAS: NABO ALGEMADO NO CONVÉS',s:'Contrato, atas, bilhetes, caneta e vídeo. O Nabo pede o VAR; o VAR recusa.',body:'Cinco provas, uma primeira página. O presidente foi levado do iate com a taça debaixo do braço e o advogado ao telemóvel. Na claque, alguém trouxe uma bola escondida no casaco.'},
 ball:{title:'A BOLA VOLTOU',body:'O futebol regressa numa terça-feira à tarde, sem VAR, sem envelopes e sem Nabo. No primeiro jogo, o miúdo da ilha marca de cabeça. A claque canta «NA-BO NA PRISÃO» até de manhã.'},
 gun:{title:'O PISTOLEIRO FICA',body:'Guardas a bola num cofre e a pistola no coldre. A liga continua, agora sem presidente e com mais audiência do que nunca. Alguém tem de ser o melhor naquilo que ficou. O prolongamento espera por ti.'}
};

/* gritos dos adversários em campo (balões por cima da cabeça) */
export const SHOUTS={
  cover:['Fecha o meio-campo!','Autocarro à frente da baliza!','Todos atrás da linha da bola!','Recua a defesa!'],
  flank:['Vou pela ala!','Desmarcação!','Ataca a profundidade!','Sobe o lateral!'],
  sup:['Árbitro! Isto é falta!','Cartão! Cartão!','Simulação!','Chamem o VAR!'],
  gren:['Lá vai o cruzamento!','Chuveirinho!','Bola parada!'],
  retreat:['Ai, a coxa! Maca!','Lesão! Chamem o fisio!','Estou a sentir o posterior!'],
  spray:['Spray mágico!','Já estou bom, mister!','Milagre do fisio!'],
  dribble:['Drible!','Chapéu!','Olé!','Elástico!'],
  peek:['Pressão alta!','Marca-o!','Vai à canela!']
};
/* Le Coq, quando para a filosofar */
export const PHILO=['O fora de jogo é o inferno dos outros.','Penso, logo defendo.','Se um remate falha e ninguém vê, foi golo?','A bola é redonda como o absurdo da existência.','O VAR observa-nos. Mas quem observa o VAR?','Não há golos, há interpretações.'];

/* ---- mais falas (análise da equipa: o locutor e os gritos repetiam-se em poucos minutos) ---- */
ANNOUNCER.wave.push('Onda {n}. O VAR está a ver... o telemóvel.','Onda {n}! Aquecimento feito, dignidade por fazer.','Onda {n}. Patrocinada por uma casa de apostas que também aposta contra ti.','Onda {n}! O treinador adversário pediu reforços. A federação pagou-os.','Onda {n}. Os comentadores já têm a desculpa preparada.','Onda {n}! O relvado é sintético, a indignação é natural.','Onda {n}. Última chamada para quem ainda acredita no fair-play.','Onda {n}! Mais adversários do que lugares no autocarro do clube.');
ANNOUNCER.clear.push('Onda limpa! O árbitro foi rever... e confirmou, desta vez.','Campo varrido. O roupeiro agradece a poupança em camisolas.','Limpinho! Nem o presidente conseguiu comprar esta.','Acabou a onda. Os adeptos pedem autógrafos, os adversários pedem ambulância.','Onda despachada. Três pontos e zero desculpas.','Fim da onda! A imprensa já escreve "exibição de gala".');
ANNOUNCER.boss.push('Entra o capitão {b}! O salário dele paga três estádios.','{b} em campo! Dizem que o contrato tem cláusula anti-pistoleiro.','Atenção: {b} chegou, com escolta e advogado.','{b} entra com o dobro da confiança e metade da defesa.');
ANNOUNCER.streak.push('Série imparável! Os dirigentes já lhe querem renovar o contrato.','Mais um! Isto já não é futebol, é contabilidade.','Série a crescer! O VAR desistiu de rever.','Que série! O banco adversário pede tempo... e um psicólogo.','Abate atrás de abate! A claque inventou um cântico novo.');
ANNOUNCER.head.push('Na cabeça! Nem o guarda-redes defendia essa.','Tiro à cabeça, direto para o resumo da semana.','Cabeçada ao contrário! E sem cartão amarelo.','Na testa! O fisioterapeuta nem se levanta.','À cabeça! Precisão de livre direto.');
ANNOUNCER.death.push('O Pistoleiro caiu. Os dirigentes já culpam o relvado.','Fora de jogo definitivo. O VAR confirma.','Caiu! A imprensa vai dizer que foi simulação.','Lesão grave para o Pistoleiro. O clube promete um comunicado.');
ANNOUNCER.lowhp.push('Pistoleiro em apuros! O massagista já está a aquecer.','Pouca vida! Mais frágil do que a defesa de um clube em crise.','Cuidado! Está no vermelho, como as contas do clube.','Vida por um fio! Procura abrigo ou um bom advogado.');
ANNOUNCER.mod.push('Regras novas a meio do jogo? Só pode ser coisa da federação.','A organização mudou as regras. Ninguém foi avisado, como sempre.','Modificador ativo, cortesia de um patrocinador duvidoso.');
ANNOUNCER.obj.push('Objetivo novo! Cumpre e há prémio de jogo.','Missão extra. O presidente prometeu pagar. Veremos.','Tarefa especial: cumpre e a claque perdoa-te tudo.');
ANNOUNCER.evt.push('Evento no estádio! A segurança foi comer bifanas.','Algo se passa na bancada! O delegado finge que não vê.','Imprevisto em campo! O quarto árbitro está a tirar selfies.');
ANNOUNCER.shop.push('Loja aberta! Os preços subiram desde o último jogo, como os bilhetes.','Hora de compras. Aceita-se dinheiro, não se aceitam reclamações.','Loja aberta! Armas novas, faturas antigas.');
SHOUTS.cover.push('Todos para trás do contentor!','Abrigo, já!','Não dês a cara, rapaz!','Protege a zona!','Encosta à parede!');
SHOUTS.flank.push('Vai pela ala!','Cruza pela esquerda!','Aproveita o corredor!','Desmarca-te pelo lado!','Ataque pela lateral!');
SHOUTS.sup.push('Mantém-no de cabeça baixa!','Fogo contínuo!','Não o deixes respirar!','Pressão alta!','Carrega nele!');
SHOUTS.gren.push('Granada! Salta!','Petardo a caminho!','Bola perdida... e explosiva!','Tira os pés daí!');
SHOUTS.retreat.push('Recua, recua!','Estou tocado, vou para o banco!','Preciso de substituição!','Chamem o massagista!');
SHOUTS.spray.push('Rega a zona toda!','Chuva de balas!','Tudo o que tiveres!','Varre a zona!');
SHOUTS.dribble.push('Olé!','Finta de corpo!','Nem me viste passar!');
SHOUTS.peek.push('Espreita e dispara!','Ele está ali!','Vi-o no canto!','Cabeça de fora, rápido!');
