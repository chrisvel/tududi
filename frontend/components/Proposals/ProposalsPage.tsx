// Life-to-Day (T-704): Proposal Review. Changes from MCP clients wait here
// until the user applies or rejects them; applied ones can be undone.
import React from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import ProposalCard from './ProposalCard';
import { fetchProposals, proposalKeys } from '../../utils/proposalsService';
import { refreshPlanning } from '../../utils/planningService';

export default function ProposalsPage() {
    const { t } = useTranslation();
    const { data, error, mutate } = useSWR(proposalKeys.list, fetchProposals);
    const proposals = data?.proposals || [];
    const pending = proposals.filter((p) => p.status === 'pending');
    const decided = proposals.filter((p) => p.status !== 'pending');
    const changed = async () => {
        await Promise.all([mutate(), refreshPlanning()]);
    };
    return (
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            <header>
                <h1 className="text-xl font-semibold">
                    {t('ltdProposals.title')}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('ltdProposals.intro')}
                </p>
            </header>
            {error && <p role="alert">{error.message}</p>}
            {data && !pending.length && (
                <p className="text-sm text-gray-500">
                    {t('ltdProposals.empty')}
                </p>
            )}
            {pending.map((proposal) => (
                <ProposalCard
                    key={`${proposal.uid}:${proposal.status}`}
                    proposal={proposal}
                    onChanged={changed}
                />
            ))}
            {decided.length > 0 && (
                <section
                    className="space-y-3"
                    aria-labelledby="proposals-history"
                >
                    <h2 id="proposals-history" className="font-medium">
                        {t('ltdProposals.history')}
                    </h2>
                    {decided.map((proposal) => (
                        <ProposalCard
                            key={`${proposal.uid}:${proposal.status}`}
                            proposal={proposal}
                            onChanged={changed}
                        />
                    ))}
                </section>
            )}
        </main>
    );
}
