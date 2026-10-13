// Life-to-Day (T-1103): the sentences of the task effect (blueprint 14.7).
// Activity and outcome are two separate sentences, and no percent of a
// task's effect is ever made (ADR-014).
import React from 'react';
import type { TFunction } from 'i18next';
import { TaskEffect } from '../../utils/lessonsService';
import { resolveDisplayLocale } from '../../utils/jalali';

const MARK = '\u0001';

// A translated sentence whose user text sits in <bdi>, so an English goal
// keeps its order inside a Persian sentence. Word order stays the
// translation's: each value is marked, then put back in place.
function sentence(
    t: TFunction,
    key: string,
    defaultValue: string,
    users: Record<string, string>,
    plain: Record<string, string> = {}
): React.ReactNode {
    const marked = Object.fromEntries(
        Object.keys(users).map((name) => [name, `${MARK}${name}${MARK}`])
    );
    const text = t(key, { ...plain, ...marked, defaultValue }) as string;
    return text
        .split(MARK)
        .map((part, index) =>
            index % 2 ? <bdi key={index}>{users[part]}</bdi> : part
        );
}

// The path line: the five-year goal, else the vision. A chain with neither
// is named by its farthest goal, in the vision sentence.
export function pathLine(effect: TaskEffect, t: TFunction): React.ReactNode {
    if (effect.kind === 'unlinked')
        return t(
            'ltdLessons.effect.unlinked',
            'This task is not linked to a goal yet.'
        );
    if (effect.fiveYear)
        return sentence(
            t,
            'ltdLessons.effect.onPath',
            'This task is on the path “{{title}}”.',
            { title: effect.fiveYear.title }
        );
    const far = effect.vision ?? effect.chain[effect.chain.length - 1];
    return sentence(
        t,
        'ltdLessons.effect.linkedTo',
        'This task is linked to “{{vision}}”.',
        { vision: far.title }
    );
}

// percent = round(value × 100), in the reader's digits.
export function outcomeLine(
    effect: TaskEffect,
    t: TFunction,
    language?: string
): React.ReactNode {
    if (effect.kind === 'unlinked') return null;
    if (!effect.outcome)
        return t(
            'ltdLessons.effect.noOutcome',
            'No metric has been recorded for this path.'
        );
    const percent = new Intl.NumberFormat(resolveDisplayLocale(language), {
        style: 'percent',
        maximumFractionDigits: 0,
    }).format(Math.round(effect.outcome.value * 100) / 100);
    return sentence(
        t,
        'ltdLessons.effect.outcome',
        'The outcome “{{title}}” is now {{percent}}. Doing the task is activity. The outcome changes when a metric is recorded.',
        { title: effect.outcome.title },
        { percent }
    );
}

// The lesson line: its if/then, else its title.
export function lessonLine(
    lesson: NonNullable<TaskEffect['lesson']>,
    t: TFunction
): React.ReactNode {
    return lesson.if_text && lesson.then_text
        ? sentence(t, 'ltdLessons.effect.ifThen', 'If {{if}}, then {{then}}.', {
              if: lesson.if_text,
              then: lesson.then_text,
          })
        : lesson.title;
}
