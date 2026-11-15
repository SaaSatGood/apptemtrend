import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { landingTestimonials } from "@/lib/testimonials";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function LandingTestimonials() {
  return (
    <section className="tt-lp-testimonials" id="depoimentos" aria-labelledby="testimonials-title">
      <div className="tt-lp-wrap">
        <div className="tt-lp-section-head tt-lp-testimonials-head" data-reveal>
          <div>
            <span className="tt-lp-kicker">Quem já está gravando</span>
            <h2 id="testimonials-title">Histórias de quem <em>começou.</em></h2>
          </div>
        </div>

        <div className="tt-lp-testimonial-grid">
          {landingTestimonials.map((item) => (
            <figure className="tt-lp-testimonial" key={item.handle} data-reveal>
              <span className="tt-lp-testimonial-mark" aria-hidden="true">“</span>
              <blockquote>{item.quote}</blockquote>
              <figcaption>
                <span className="tt-lp-testimonial-avatar" aria-hidden="true">{initials(item.name)}</span>
                <div className="tt-lp-testimonial-id">
                  <strong>{item.name}</strong>
                  <a href={item.profileUrl} target="_blank" rel="noopener noreferrer">
                    {item.handle}
                    <Icon name="arrow-up-right" size={12} />
                  </a>
                </div>
                <span className="tt-lp-testimonial-badge">{item.badge}</span>
              </figcaption>
              <p className="tt-lp-testimonial-meta">
                <span>{item.niche}</span>
                {item.result}
              </p>
            </figure>
          ))}
        </div>

        <p className="tt-lp-testimonial-note" data-reveal>
          Depoimentos de creators que usaram a TemTrend.
          <Link href="/descobrir?mode=signup">Começar grátis <Icon name="arrow-right" size={14} /></Link>
        </p>
      </div>
    </section>
  );
}
