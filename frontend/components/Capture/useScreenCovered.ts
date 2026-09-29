import { useEffect, useState } from 'react';

// How much of the viewport a fixed element has to cover to count as a modal,
// sheet or full-screen editor.
const COVERAGE = 0.9;

const coversScreen = (el: HTMLElement): boolean => {
    const rect = el.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const visibleWidth = Math.min(rect.right, width) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, height) - Math.max(rect.top, 0);
    if (visibleWidth < width * COVERAGE || visibleHeight < height * COVERAGE) {
        return false;
    }
    const style = window.getComputedStyle(el);
    return (
        style.position === 'fixed' &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        style.pointerEvents !== 'none'
    );
};

// True while something fixed covers the screen: a modal backdrop, a sheet,
// a full-screen editor or the phone sidebar. Watching the page instead of
// asking every modal to report itself keeps new modals covered too. Only
// runs while `enabled`, since only the phone button needs it.
export const useScreenCovered = (
    enabled: boolean,
    ignoreSelector: string
): boolean => {
    const [covered, setCovered] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setCovered(false);
            return undefined;
        }
        let frame = 0;
        const check = () => {
            frame = 0;
            const fixed = document.body.querySelectorAll<HTMLElement>('.fixed');
            setCovered(
                Array.from(fixed).some(
                    (el) => !el.closest(ignoreSelector) && coversScreen(el)
                )
            );
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(check);
        };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden'],
        });
        window.addEventListener('resize', schedule);
        // Sheets and drawers slide in with a transition.
        document.addEventListener('transitionend', schedule, true);
        schedule();
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', schedule);
            document.removeEventListener('transitionend', schedule, true);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [enabled, ignoreSelector]);

    return covered;
};
