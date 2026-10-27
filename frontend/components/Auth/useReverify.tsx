import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    ReauthMethod,
    ReauthRequiredError,
    reverify,
} from '../../utils/mfaService';

interface Pending {
    method: ReauthMethod;
    resolve: (ok: boolean) => void;
}

// Runs an action that may need the password or a 2FA code typed again
// (the server answers 403 reauth_required). Shows one prompt, confirms it,
// then runs the action once more. Render `reverifyModal` somewhere in the
// component that uses it.
export function useReverify() {
    const { t } = useTranslation();
    const [pending, setPending] = useState<Pending | null>(null);
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const pendingRef = useRef<Pending | null>(null);

    const ask = (method: ReauthMethod) =>
        new Promise<boolean>((resolve) => {
            const next = { method, resolve };
            pendingRef.current = next;
            setValue('');
            setError(null);
            setPending(next);
        });

    const close = (ok: boolean) => {
        pendingRef.current?.resolve(ok);
        pendingRef.current = null;
        setPending(null);
    };

    const runWithReverify = useCallback(
        async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
            try {
                return await action();
            } catch (err) {
                if (!(err instanceof ReauthRequiredError)) throw err;
                if (!(await ask(err.method))) return undefined;
                return action();
            }
        },
        []
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pending) return;
        setSubmitting(true);
        setError(null);
        try {
            await reverify(
                pending.method === 'code'
                    ? /^\d{6}$/.test(value.replace(/\s/g, ''))
                        ? { code: value }
                        : { recovery_code: value }
                    : { password: value }
            );
            close(true);
        } catch (err: any) {
            setValue('');
            setError(
                err?.status === 429
                    ? t(
                          'mfa.tooManyAttempts',
                          'Too many incorrect codes. Please try again in 15 minutes.'
                      )
                    : pending.method === 'code'
                      ? t('mfa.wrongCode', 'That code is not right. Try again.')
                      : t('mfa.wrongPassword', 'That password is not right.')
            );
        } finally {
            setSubmitting(false);
        }
    };

    // Portalled to <body>: callers may sit inside another <form>, where a
    // nested form would be dropped.
    const reverifyModal = pending
        ? createPortal(
              <div
                  className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
                  onClick={() => close(false)}
              >
                  <form
                      onSubmit={handleSubmit}
                      className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md mx-4"
                      onClick={(e) => e.stopPropagation()}
                      data-testid="reverify-modal"
                  >
                      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                          {t('mfa.reverifyTitle', 'Confirm it is you')}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {pending.method === 'code'
                              ? t(
                                    'mfa.reverifyCode',
                                    'Enter a code from your authenticator app to continue.'
                                )
                              : t(
                                    'mfa.reverifyPassword',
                                    'Enter your password to continue.'
                                )}
                      </p>
                      <input
                          type={pending.method === 'code' ? 'text' : 'password'}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          autoComplete={
                              pending.method === 'code'
                                  ? 'one-time-code'
                                  : 'current-password'
                          }
                          inputMode={
                              pending.method === 'code' ? 'numeric' : undefined
                          }
                          autoFocus
                          required
                          className="block w-full rounded-md px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          data-testid="reverify-input"
                      />
                      {error && (
                          <div className="mt-2 text-sm text-red-500">
                              {error}
                          </div>
                      )}
                      <div className="mt-6 flex justify-end space-x-3">
                          <button
                              type="button"
                              onClick={() => close(false)}
                              className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                          >
                              {t('common.cancel', 'Cancel')}
                          </button>
                          <button
                              type="submit"
                              disabled={submitting || !value}
                              className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                              data-testid="reverify-submit"
                          >
                              {t('mfa.confirm', 'Confirm')}
                          </button>
                      </div>
                  </form>
              </div>,
              document.body
          )
        : null;

    return { runWithReverify, reverifyModal };
}
