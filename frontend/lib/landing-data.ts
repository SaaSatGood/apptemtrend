export const peoplePhotos = [
  { src: 'https://images.pexels.com/photos/8370744/pexels-photo-8370744.jpeg?auto=compress&fit=crop&w=900&q=82', alt: 'Pessoa gravando conteúdo vertical com celular e ring light' },
  { src: 'https://images.pexels.com/photos/6954092/pexels-photo-6954092.jpeg?auto=compress&fit=crop&w=900&q=82', alt: 'Criadora preparando o celular para gravar um vídeo' },
  { src: 'https://images.pexels.com/photos/8993746/pexels-photo-8993746.jpeg?auto=compress&fit=crop&w=900&q=82', alt: 'Pessoa sorrindo enquanto grava conteúdo com ring light' },
];
export type ReelVideo = { src: string; poster: string; label: string; tip: string; creator: string; sourceUrl: string; tiktokHandle?: string; tiktokUrl?: string };
// sourceUrl mantém a atribuição do acervo (Pexels) sem link externo na página.
export const reelMedia: ReelVideo[] = [
  { src: 'https://videos.pexels.com/video-files/8357560/8357560-hd_1080_2048_25fps.mp4', poster: peoplePhotos[1].src, label: 'Comece com uma tomada simples', tip: 'Apoie o celular e encontre um enquadramento.', creator: 'Ron Lach', sourceUrl: 'https://www.pexels.com/video/person-recording-herself-on-her-cellphone-8357560/' },
  { src: 'https://videos.pexels.com/video-files/8993486/8993486-hd_1080_1920_30fps.mp4', poster: 'https://images.pexels.com/photos/12432850/pexels-photo-12432850.jpeg?auto=compress&fit=crop&w=700&q=82', label: 'Use a luz que você tem', tip: 'Teste um lugar claro antes de gravar.', creator: 'Hanna Pad', sourceUrl: 'https://www.pexels.com/video/a-woman-recording-herself-with-a-smartphone-8993486/' },
  { src: 'https://videos.pexels.com/video-files/8360173/8360173-hd_1080_2048_25fps.mp4', poster: peoplePhotos[2].src, label: 'Mostre uma ação', tip: 'Uma cena em movimento já conta algo.', creator: 'Ron Lach', sourceUrl: 'https://www.pexels.com/video/man-recording-himself-with-a-smartphone-8360173/' },
  { src: 'https://videos.pexels.com/video-files/7480852/7480852-hd_1080_1920_25fps.mp4', poster: peoplePhotos[0].src, label: 'Teste o enquadramento', tip: 'Ajuste o celular e grave alguns segundos.', creator: 'MART PRODUCTION', sourceUrl: 'https://www.pexels.com/video/woman-recording-herself-on-a-phone-7480852/' },
  { src: 'https://videos.pexels.com/video-files/9384669/9384669-hd_1080_1920_24fps.mp4', poster: 'https://images.pexels.com/photos/9413649/pexels-photo-9413649.jpeg?auto=compress&fit=crop&w=700&q=82', label: 'Prepare só o essencial', tip: 'Luz e posição prontas. Agora é gravar.', creator: 'Sasha Kim', sourceUrl: 'https://www.pexels.com/video/woman-setting-up-her-smartphone-and-ring-light-9384669/' },
  { src: 'https://videos.pexels.com/video-files/8360260/8360260-hd_1080_2048_25fps.mp4', poster: 'https://images.pexels.com/photos/4793188/pexels-photo-4793188.jpeg?auto=compress&fit=crop&w=700&q=82', label: 'Faça outra tentativa', tip: 'Repita, ajuste e escolha depois.', creator: 'Ron Lach', sourceUrl: 'https://www.pexels.com/video/man-recording-himself-in-a-smartphone-8360260/' },
];
export const faqs: Array<[string, string]> = [
  ['O que é a TemTrend?', 'Uma plataforma para encontrar produtos e receber planos práticos de conteúdo para TikTok Shop.'],
  ['Preciso ser influencer?', 'Não. A TemTrend foi pensada para pessoas comuns, iniciantes e creators experientes.'],
  ['Preciso ter muitos seguidores?', 'Não. O foco é ajudar você a criar conteúdo mais claro e executável, independentemente do tamanho da audiência.'],
  ['O que é o plano de gravação?', 'É um guia para o vídeo, também chamado Content Kit: traz ideia, abertura, cenas, roteiro, legenda, chamada final, hashtags e duração sugerida.'],
  ['A TemTrend grava o vídeo para mim?', 'Não. Você grava e publica. A TemTrend mostra o que fazer para você não começar do zero.'],
  ['Como funciona a venda pelo TikTok Shop?', 'Você publica conteúdo associado a produtos dentro das regras e recursos disponíveis no TikTok Shop. Resultados não são garantidos.'],
  ['Posso adaptar o plano para outros tipos de conteúdo?', 'Sim. Você pode adaptar o roteiro, as cenas e a fala para o seu estilo e formato.'],
  ['Preciso aparecer no vídeo?', 'Não necessariamente. Você pode adaptar o roteiro para demonstrações do produto e formatos sem aparecer na câmera.'],
  ['O que acontece depois que escolho um plano?', 'Você pode adicionar o produto à sua produção, usar o roteiro para gravar no aplicativo de câmera que preferir e acompanhar as etapas até marcar o vídeo como publicado.'],
  ['A TemTrend publica o vídeo automaticamente?', 'Não. A gravação e a publicação são feitas por você. A TemTrend organiza o plano e permite acompanhar o andamento da sua produção.'],
];
