import React from 'react';
import { useTranslation } from 'react-i18next';
import { BlogLinks } from '../../utils/blogService';

// The offer every post ends on: tududi Cloud, its price and a way in.
const BlogCta: React.FC<{ links: BlogLinks }> = ({ links }) => {
    const { t, i18n } = useTranslation();
    const money = (amount: number) =>
        new Intl.NumberFormat(i18n.language || 'en', {
            style: 'currency',
            currency: links.pricing.currency || 'EUR',
            maximumFractionDigits: 0,
        }).format(amount);

    return (
        <section
            className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-6 py-10 sm:px-10 sm:py-12"
            data-testid="blog-cta"
        >
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-100">
                {t('blog.ctaEyebrow', 'tududi Cloud')}
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
                {t('blog.ctaTitle', 'Get the small things out of your head.')}
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-blue-50">
                {t(
                    'blog.ctaBody',
                    'Tasks, projects, notes and habits in one calm place, shared with the people you live and work with. No server, nothing to install.'
                )}
            </p>
            <p className="mt-4 text-blue-100" data-testid="blog-cta-price">
                {t(
                    'blog.ctaPrice',
                    '{{monthly}} a month or {{annual}} a year',
                    {
                        monthly: money(links.pricing.monthly),
                        annual: money(links.pricing.annual),
                    }
                )}
                {' · '}
                {t('blog.ctaGuarantee', '14-day money-back guarantee')}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                    href={links.register}
                    className="inline-flex justify-center px-6 py-3 rounded-full bg-white text-blue-700 font-semibold hover:bg-blue-50"
                >
                    {t('blog.ctaPrimary', 'Start with tududi Cloud')}
                </a>
                <a
                    href={links.cloud}
                    className="inline-flex justify-center px-6 py-3 rounded-full bg-white/10 text-white font-semibold hover:bg-white/20"
                >
                    {t('blog.ctaSecondary', 'See what is included')}
                </a>
            </div>
        </section>
    );
};

export default BlogCta;
