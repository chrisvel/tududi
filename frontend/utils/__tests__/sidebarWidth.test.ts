import {
    SIDEBAR_DEFAULT_PERCENT,
    SIDEBAR_MAX_PERCENT,
    SIDEBAR_MIN_PERCENT,
    clampSidebarPercent,
    sidebarPercentToRem,
    sidebarPxToPercent,
} from '../sidebarWidth';

describe('sidebarWidth', () => {
    describe('clampSidebarPercent', () => {
        it('keeps a value inside the allowed range', () => {
            expect(clampSidebarPercent(95)).toBe(95);
        });

        it('limits the width to 10% narrower than the default', () => {
            expect(clampSidebarPercent(50)).toBe(SIDEBAR_MIN_PERCENT);
            expect(SIDEBAR_MIN_PERCENT).toBe(90);
        });

        it('limits the width to 10% wider than the default', () => {
            expect(clampSidebarPercent(140)).toBe(SIDEBAR_MAX_PERCENT);
            expect(SIDEBAR_MAX_PERCENT).toBe(110);
        });

        it('keeps 100% as the default width', () => {
            expect(SIDEBAR_DEFAULT_PERCENT).toBe(100);
        });

        it('rounds to a whole percent', () => {
            expect(clampSidebarPercent(93.6)).toBe(94);
        });

        it.each([undefined, null, '95', NaN, Infinity])(
            'falls back to the default for %p',
            (value) => {
                expect(clampSidebarPercent(value)).toBe(
                    SIDEBAR_DEFAULT_PERCENT
                );
            }
        );
    });

    describe('sidebarPercentToRem', () => {
        it('maps the default to 22rem', () => {
            expect(sidebarPercentToRem(100)).toBe(22);
        });

        it('maps the narrowest width to 19.8rem', () => {
            expect(sidebarPercentToRem(90)).toBeCloseTo(19.8);
        });

        it('maps the widest width to 24.2rem', () => {
            expect(sidebarPercentToRem(110)).toBeCloseTo(24.2);
        });
    });

    describe('sidebarPxToPercent', () => {
        it('turns a pointer position into a percentage of the default width', () => {
            expect(sidebarPxToPercent(330, 16)).toBe(94);
        });

        it('clamps a pointer far to the left or right', () => {
            expect(sidebarPxToPercent(10, 16)).toBe(90);
            expect(sidebarPxToPercent(900, 16)).toBe(110);
        });

        it('follows the root font size', () => {
            expect(sidebarPxToPercent(352, 16)).toBe(100);
            expect(sidebarPxToPercent(396, 18)).toBe(100);
            expect(sidebarPxToPercent(356, 18)).toBe(90);
            expect(sidebarPxToPercent(436, 18)).toBe(110);
        });
    });
});
