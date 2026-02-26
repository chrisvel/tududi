import {
    QUADRANT_STYLES,
    QUADRANT_STYLE_DEFAULT,
    getQuadrantStyle,
    QuadrantStyle,
} from '../../constants/matrixColors';

describe('matrixColors', () => {
    describe('QUADRANT_STYLES', () => {
        it('should define styles for quadrants 0-3', () => {
            expect(QUADRANT_STYLES[0]).toBeDefined();
            expect(QUADRANT_STYLES[1]).toBeDefined();
            expect(QUADRANT_STYLES[2]).toBeDefined();
            expect(QUADRANT_STYLES[3]).toBeDefined();
        });

        it('should not define styles for quadrant 4', () => {
            expect(QUADRANT_STYLES[4]).toBeUndefined();
        });

        it('should have all required properties on each style', () => {
            const requiredKeys: (keyof QuadrantStyle)[] = [
                'dot',
                'bg',
                'bgSubtle',
                'text',
                'ring',
            ];

            for (let i = 0; i < 4; i++) {
                for (const key of requiredKeys) {
                    expect(QUADRANT_STYLES[i][key]).toBeDefined();
                    expect(typeof QUADRANT_STYLES[i][key]).toBe('string');
                    expect(QUADRANT_STYLES[i][key].length).toBeGreaterThan(0);
                }
            }
        });

        it('should use urgency-based colors: red → amber → blue → green', () => {
            expect(QUADRANT_STYLES[0].dot).toContain('rose');
            expect(QUADRANT_STYLES[1].dot).toContain('amber');
            expect(QUADRANT_STYLES[2].dot).toContain('sky');
            expect(QUADRANT_STYLES[3].dot).toContain('emerald');
        });

        it('should use unique colors for each quadrant', () => {
            const dots = [0, 1, 2, 3].map((i) => QUADRANT_STYLES[i].dot);
            const unique = new Set(dots);
            expect(unique.size).toBe(4);
        });
    });

    describe('QUADRANT_STYLE_DEFAULT', () => {
        it('should have all required properties', () => {
            expect(QUADRANT_STYLE_DEFAULT.dot).toBeDefined();
            expect(QUADRANT_STYLE_DEFAULT.bg).toBeDefined();
            expect(QUADRANT_STYLE_DEFAULT.bgSubtle).toBeDefined();
            expect(QUADRANT_STYLE_DEFAULT.text).toBeDefined();
            expect(QUADRANT_STYLE_DEFAULT.ring).toBeDefined();
        });

        it('should use gray as the fallback color', () => {
            expect(QUADRANT_STYLE_DEFAULT.dot).toContain('gray');
        });
    });

    describe('getQuadrantStyle', () => {
        it('should return correct style for valid indices 0-3', () => {
            expect(getQuadrantStyle(0)).toBe(QUADRANT_STYLES[0]);
            expect(getQuadrantStyle(1)).toBe(QUADRANT_STYLES[1]);
            expect(getQuadrantStyle(2)).toBe(QUADRANT_STYLES[2]);
            expect(getQuadrantStyle(3)).toBe(QUADRANT_STYLES[3]);
        });

        it('should return fallback for out-of-range index', () => {
            expect(getQuadrantStyle(4)).toBe(QUADRANT_STYLE_DEFAULT);
            expect(getQuadrantStyle(-1)).toBe(QUADRANT_STYLE_DEFAULT);
            expect(getQuadrantStyle(99)).toBe(QUADRANT_STYLE_DEFAULT);
        });
    });
});
