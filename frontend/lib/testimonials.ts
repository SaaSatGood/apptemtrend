export type LandingTestimonial = {
  quote: string;
  name: string;
  handle: string;
  profileUrl: string;
  niche: string;
  result: string;
  badge: string;
};

/**
 * Depoimentos exibidos na landing.
 *
 * ATENÇÃO: os textos abaixo são ilustrativos, usados para validar o layout.
 * Antes de publicar em produção, troque por depoimentos reais — com autorização
 * de uso por escrito de cada creator — ou remova a seção.
 */
export const landingTestimonials: LandingTestimonial[] = [
  {
    quote: "Eu travava na hora de abrir o vídeo. Com o plano pronto, gravei cinco vídeos em uma semana.",
    name: "Marina Alves",
    handle: "@marinacasaemordem",
    profileUrl: "https://www.tiktok.com/@marinacasaemordem",
    niche: "Casa e organização",
    result: "Gravou 5 vídeos na semana",
    badge: "5 vídeos",
  },
  {
    quote: "A abertura já vinha pronta. Adaptei para o meu jeito e gravei na primeira tentativa.",
    name: "Júlia Prado",
    handle: "@juliapradobeauty",
    profileUrl: "https://www.tiktok.com/@juliapradobeauty",
    niche: "Beleza e skincare",
    result: "Finalizou o primeiro roteiro no mesmo dia",
    badge: "1ª tentativa",
  },
  {
    quote: "Escolhi o produto, peguei o roteiro e comecei a gravar em doze minutos.",
    name: "Rafael Nunes",
    handle: "@rafanunestech",
    profileUrl: "https://www.tiktok.com/@rafanunestech",
    niche: "Tech e gadgets",
    result: "Saiu da busca para a gravação em 12 minutos",
    badge: "12 min",
  },
  {
    quote: "Meu problema era achar ideia todo dia. Com o roteiro pronto, gravei a semana inteira em uma tarde.",
    name: "Rafael Silva",
    handle: "@osilvarj_",
    profileUrl: "https://www.instagram.com/osilvarj_/",
    niche: "Humor e rotina",
    result: "Gravou a semana inteira em uma tarde",
    badge: "1 tarde",
  },
];
