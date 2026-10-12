// Life-to-Day (T-706): connected MCP clients, per-client revocation, the
// read-only switch and the kill switch (blueprint 17.6).
import React, { useState } from 'react';
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDisplayDate } from '../../utils/jalali';
import {
    McpAccess,
    enableMcpWrites,
    fetchMcpAccess,
    mcpKillSwitch,
    proposalKeys,
    revokeMcpClient,
    setMcpReadOnly,
} from '../../utils/proposalsService';

const when = (value: string | null | undefined) =>
    value
        ? formatDisplayDate(new Date(value), {
              dateStyle: 'medium',
              timeStyle: 'short',
          })
        : null;

export default function McpClientsPanel() {
    const { t } = useTranslation();
    const { data, error, mutate } = useSWR(
        proposalKeys.clients,
        fetchMcpAccess
    );
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState('');
    const [confirmKill, setConfirmKill] = useState(false);
    const act = async (fn: () => Promise<McpAccess>) => {
        setBusy(true);
        setFailure('');
        try {
            await mutate(await fn(), { revalidate: false });
        } catch (e) {
            setFailure((e as Error).message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <section
            className="space-y-4 border-s-4 border-indigo-500 ps-4"
            aria-labelledby="mcp-clients-title"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4
                    id="mcp-clients-title"
                    className="font-semibold text-gray-900 dark:text-white"
                >
                    {t('ltdProposals.clients.title')}
                </h4>
                <Link
                    to="/proposals"
                    className="text-sm text-indigo-600 underline"
                >
                    {t('ltdProposals.clients.review')}
                </Link>
            </div>
            {(error || failure) && (
                <p role="alert" className="text-sm text-red-600">
                    <bdi>{failure || error.message}</bdi>
                </p>
            )}
            {data && !data.clients.length && (
                <p className="text-sm text-gray-500">
                    {t('ltdProposals.clients.none')}
                </p>
            )}
            <ul className="space-y-3">
                {data?.clients.map((client) => (
                    <li
                        key={client.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"
                    >
                        <div className="min-w-0 space-y-0.5">
                            <div className="font-medium">
                                <bdi>
                                    {client.name ||
                                        t(
                                            `ltdProposals.clients.kind.${client.kind}`
                                        )}
                                </bdi>
                                {client.redirect_host && (
                                    <span
                                        className="ms-2 text-gray-500"
                                        dir="ltr"
                                    >
                                        {client.redirect_host}
                                    </span>
                                )}
                            </div>
                            {client.scopes && client.scopes.length > 0 && (
                                <div
                                    className="text-xs text-gray-500"
                                    dir="ltr"
                                >
                                    {client.scopes.join(' ')}
                                </div>
                            )}
                            {client.last_used_at && (
                                <div className="text-xs text-gray-500">
                                    {t('ltdProposals.clients.lastUsed', {
                                        when: when(client.last_used_at),
                                    })}
                                </div>
                            )}
                            {client.writes_disabled_at && (
                                <div className="text-xs text-red-600">
                                    {t('ltdProposals.clients.writesDisabled')}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {client.writes_disabled_at && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    className="rounded border px-3 py-1"
                                    onClick={() =>
                                        void act(() =>
                                            enableMcpWrites(client.key)
                                        )
                                    }
                                >
                                    {t('ltdProposals.clients.enableWrites')}
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={busy}
                                className="rounded border px-3 py-1"
                                onClick={() =>
                                    void act(() => revokeMcpClient(client.key))
                                }
                            >
                                {t('ltdProposals.clients.revoke')}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
            {data && (
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={data.read_only}
                        disabled={busy}
                        onChange={(e) =>
                            void act(() => setMcpReadOnly(e.target.checked))
                        }
                    />
                    {t('ltdProposals.clients.readOnly')}
                </label>
            )}
            {data?.tokens_revoked_at && (
                <p className="text-xs text-gray-500">
                    {t('ltdProposals.clients.revokedAt', {
                        when: when(data.tokens_revoked_at),
                    })}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
                {confirmKill ? (
                    <>
                        <span className="text-sm">
                            {t('ltdProposals.clients.killConfirm')}
                        </span>
                        <button
                            type="button"
                            disabled={busy}
                            className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                            onClick={() =>
                                void act(mcpKillSwitch).then(() =>
                                    setConfirmKill(false)
                                )
                            }
                        >
                            {t('ltdProposals.clients.killYes')}
                        </button>
                        <button
                            type="button"
                            className="rounded border px-3 py-1 text-sm"
                            onClick={() => setConfirmKill(false)}
                        >
                            {t('ltdProposals.clients.cancel')}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        className="rounded border border-red-600 px-3 py-1 text-sm text-red-600"
                        onClick={() => setConfirmKill(true)}
                    >
                        {t('ltdProposals.clients.kill')}
                    </button>
                )}
            </div>
        </section>
    );
}
