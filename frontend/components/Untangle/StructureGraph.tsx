import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UntangleArea, UntangleKind } from '../../utils/untangleService';

// The plan drawn as the tree tududi stores: areas hold goals, goals hold
// projects, projects hold tasks, and the loose items hang off their area.
// A small tidy-tree layout, no library: leaves stack top to bottom, every
// parent sits level with the middle of its children. Labels wrap rather
// than get cut. The panel is deliberately dark in both themes: links draw
// themselves in, nodes light up, and hovering or tapping a node lights its
// whole path while the rest dims.

type NodeType = 'root' | 'area' | 'goal' | 'project' | UntangleKind;

interface GraphNode {
    id: string;
    label: string;
    sub?: string;
    type: NodeType;
    children: GraphNode[];
}

interface Placed {
    node: GraphNode;
    x: number;
    y: number;
    depth: number;
    lines: string[];
    parent: Placed | null;
}

const MAX_COLUMN = 190;
const MIN_COLUMN = 124;
const ROW = 20;
const LEFT = 72;
const RIGHT = 210;
const LEAF_CHARS = 28;
const NODE_CHARS = 18;
const NARROW = 600;

const COLOR: Record<NodeType, string> = {
    root: '#e7e3da',
    area: '#ffffff',
    goal: '#ffd98a',
    project: '#f3f1ec',
    task: '#e7e3da',
    waiting: '#ffb4b4',
    habit: '#d9c9ff',
    someday: '#dcd7c9',
};

const RADIUS: Record<NodeType, number> = {
    root: 6,
    area: 7.5,
    goal: 6,
    project: 5.5,
    task: 4,
    waiting: 4.5,
    habit: 4.5,
    someday: 3.5,
};

// Word-wrap a label into at most two lines of about `max` characters.
function wrap(text: string, max: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > max && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    }
    if (current) lines.push(current);
    if (lines.length > 2) return [lines[0], lines.slice(1).join(' ')];
    return lines;
}

function shortDate(iso: string): string {
    const date = new Date(`${iso}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? iso
        : date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
          });
}

function buildTree(areas: UntangleArea[], rootLabel: string): GraphNode {
    let n = 0;
    const id = () => `n${(n += 1)}`;
    return {
        id: id(),
        label: rootLabel,
        type: 'root',
        children: areas.map((area) => {
            const projects: GraphNode[] = area.projects.map((p) => ({
                id: id(),
                label: p.name,
                type: 'project',
                children: p.tasks.map((t) => ({
                    id: id(),
                    label: t.title,
                    sub: t.due ? shortDate(t.due) : undefined,
                    type: 'task',
                    children: [],
                })),
            }));
            const items: GraphNode[] = area.items.map((it) => ({
                id: id(),
                label: it.title,
                sub:
                    it.kind === 'waiting' && it.person
                        ? it.person
                        : it.due
                          ? shortDate(it.due)
                          : undefined,
                type: it.kind,
                children: [],
            }));
            const children = area.goal
                ? [
                      {
                          id: id(),
                          label: area.goal.title,
                          type: 'goal' as NodeType,
                          children: projects,
                      },
                      ...items,
                  ]
                : [...projects, ...items];
            return { id: id(), label: area.name, type: 'area', children };
        }),
    };
}

function layout(
    root: GraphNode,
    column: number
): { placed: Placed[]; depth: number; height: number } {
    const placed: Placed[] = [];
    let cursor = 0;
    let maxDepth = 0;
    const place = (
        node: GraphNode,
        depth: number,
        parent: Placed | null
    ): Placed => {
        maxDepth = Math.max(maxDepth, depth);
        const isLeaf = node.children.length === 0;
        const lines = wrap(node.label, isLeaf ? LEAF_CHARS : NODE_CHARS);
        const me: Placed = {
            node,
            x: depth * column,
            y: 0,
            depth,
            lines,
            parent,
        };
        if (isLeaf) {
            // A leaf takes a row per line, plus a bit for its sub label
            const rows = lines.length + (node.sub ? 0.6 : 0);
            me.y = cursor + (rows * ROW) / 2;
            cursor += rows * ROW + 6;
        } else {
            const kids = node.children.map((child) =>
                place(child, depth + 1, me)
            );
            me.y = (kids[0].y + kids[kids.length - 1].y) / 2;
        }
        placed.push(me);
        return me;
    };
    place(root, 0, null);
    return { placed, depth: maxDepth, height: cursor };
}

const OutlineNode: React.FC<{
    node: GraphNode;
    depth: number;
    index: number;
}> = ({ node, depth, index }) => (
    <li
        className="ug-pop"
        style={{ animationDelay: `${Math.min(index * 35, 1200)}ms` }}
    >
        <div className="flex items-baseline gap-2 py-0.5">
            <span
                className={`relative top-[1px] inline-block h-2.5 w-2.5 shrink-0 ${
                    node.type === 'project' ? 'rounded-[3px]' : 'rounded-full'
                }`}
                style={{
                    background:
                        node.type === 'goal' ? 'transparent' : COLOR[node.type],
                    boxShadow:
                        node.type === 'goal'
                            ? `inset 0 0 0 1.5px ${COLOR.goal}`
                            : node.type === 'area'
                              ? `0 0 10px ${COLOR.area}`
                              : undefined,
                }}
            />
            <span
                className={`min-w-0 break-words text-sm ${
                    node.type === 'area'
                        ? 'font-semibold text-white'
                        : node.type === 'goal' || node.type === 'project'
                          ? 'font-medium text-white'
                          : node.type === 'someday' || node.type === 'root'
                            ? 'text-white/80'
                            : 'text-white'
                }`}
            >
                {node.label}
                {node.sub && (
                    <span className="ml-1.5 text-xs text-white/85">
                        {node.sub}
                    </span>
                )}
            </span>
        </div>
        {node.children.length > 0 && (
            <ul
                className={`ml-[5px] border-l border-white/30 pl-4 ${
                    depth === 0 ? 'mt-1 flex flex-col gap-2' : ''
                }`}
            >
                {node.children.map((child, i) => (
                    <OutlineNode
                        key={child.id}
                        node={child}
                        depth={depth + 1}
                        index={index + i + 1}
                    />
                ))}
            </ul>
        )}
    </li>
);

const StructureGraph: React.FC<{ areas: UntangleArea[] }> = ({ areas }) => {
    const { t } = useTranslation();
    const tree = useMemo(
        () => buildTree(areas, t('untangle.graph.root', 'Your list')),
        [areas, t]
    );

    // Columns stretch to the panel on a wide screen and shrink to a floor
    // on a narrow one, past which the panel scrolls sideways.
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [boxWidth, setBoxWidth] = useState(0);
    useEffect(() => {
        const el = boxRef.current;
        if (!el) return undefined;
        const measure = () => setBoxWidth(el.clientWidth);
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const depthGuess = useMemo(() => layout(tree, 1).depth, [tree]);
    const column = Math.max(
        MIN_COLUMN,
        Math.min(
            MAX_COLUMN,
            boxWidth > 0
                ? (boxWidth - LEFT - RIGHT) / Math.max(1, depthGuess)
                : MAX_COLUMN
        )
    );
    const { placed, depth, height } = useMemo(
        () => layout(tree, column),
        [tree, column]
    );
    const width = LEFT + depth * column + RIGHT;
    const svgHeight = height + 40;

    // Focus: a hovered or tapped node lights its ancestors and descendants;
    // a legend chip lights every node of that kind.
    const [focusId, setFocusId] = useState<string | null>(null);
    const [pinnedId, setPinnedId] = useState<string | null>(null);
    const [kindFilter, setKindFilter] = useState<NodeType | null>(null);
    const activeId = pinnedId || focusId;
    const lit = useMemo(() => {
        const set = new Set<string>();
        if (kindFilter) {
            for (const p of placed) {
                if (p.node.type === kindFilter) set.add(p.node.id);
            }
            return set;
        }
        if (!activeId) return null;
        const me = placed.find((p) => p.node.id === activeId);
        if (!me) return null;
        let up: Placed | null = me;
        while (up) {
            set.add(up.node.id);
            up = up.parent;
        }
        const down = (n: GraphNode) => {
            set.add(n.id);
            n.children.forEach(down);
        };
        down(me.node);
        return set;
    }, [activeId, kindFilter, placed]);
    const isLit = (id: string) => !lit || lit.has(id);
    const linkLit = (a: Placed, b: Placed) =>
        !lit || (lit.has(a.node.id) && lit.has(b.node.id));

    const legend: { type: NodeType; label: string }[] = [
        { type: 'area', label: t('untangle.graph.area', 'Area') },
        { type: 'goal', label: t('untangle.graph.goal', 'Goal') },
        { type: 'project', label: t('untangle.graph.project', 'Project') },
        { type: 'task', label: t('untangle.graph.task', 'Task') },
        { type: 'waiting', label: t('untangle.graph.waiting', 'Waiting for') },
        { type: 'habit', label: t('untangle.graph.habit', 'Habit') },
        { type: 'someday', label: t('untangle.graph.someday', 'Someday') },
    ];

    const narrow = boxWidth > 0 && boxWidth < NARROW;
    const order = new Map(placed.map((p, i) => [p.node.id, i]));

    return (
        <div
            className="ug-panel relative overflow-hidden rounded-2xl p-4 text-white sm:p-5"
            data-testid="untangle-graph"
        >
            <style>{`
                .ug-panel { background: radial-gradient(120% 80% at 10% 0%, #6f93ae 0%, #5a7d9a 55%, #3b566d 100%); }
                .ug-panel::before { content: ''; position: absolute; inset: 0; pointer-events: none;
                    background-image: linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px);
                    background-size: 28px 28px; mask-image: radial-gradient(80% 80% at 50% 40%, #000 30%, transparent 100%); -webkit-mask-image: radial-gradient(80% 80% at 50% 40%, #000 30%, transparent 100%); }
                .ug-link { stroke-dasharray: 600; stroke-dashoffset: 600; animation: ug-draw 1.1s cubic-bezier(.4,0,.2,1) forwards; transition: opacity .25s, stroke .25s; }
                .ug-node { transform-origin: 0 0; animation: ug-pop .45s cubic-bezier(.2,.9,.3,1.4) both; transition: opacity .25s; cursor: pointer; }
                .ug-pop { animation: ug-fade .4s ease-out both; }
                .ug-dim { opacity: .18; }
                .ug-chip { transition: background .2s, color .2s; }
                @keyframes ug-draw { to { stroke-dashoffset: 0; } }
                @keyframes ug-pop { from { opacity: 0; transform: scale(.3); } to { opacity: 1; transform: scale(1); } }
                @keyframes ug-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
                @media (prefers-reduced-motion: reduce) { .ug-link, .ug-node, .ug-pop { animation: none; stroke-dashoffset: 0; opacity: 1; } }
            `}</style>

            <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px]">
                {legend.map((l) => {
                    const on = kindFilter === l.type;
                    return (
                        <button
                            key={l.type}
                            type="button"
                            onClick={() => setKindFilter(on ? null : l.type)}
                            aria-pressed={on}
                            className={`ug-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                                on
                                    ? 'bg-white/30 text-white'
                                    : 'bg-white/15 text-white hover:bg-white/25'
                            }`}
                            data-testid={`untangle-graph-kind-${l.type}`}
                        >
                            <span
                                className={`inline-block h-2 w-2 ${
                                    l.type === 'project'
                                        ? 'rounded-[2px]'
                                        : 'rounded-full'
                                }`}
                                style={{
                                    background:
                                        l.type === 'goal'
                                            ? 'transparent'
                                            : COLOR[l.type],
                                    boxShadow:
                                        l.type === 'goal'
                                            ? `inset 0 0 0 1.5px ${COLOR.goal}`
                                            : undefined,
                                }}
                            />
                            {l.label}
                        </button>
                    );
                })}
                <span className="ml-auto hidden text-white/85 sm:inline">
                    {t(
                        'untangle.graph.hint',
                        'Hover or tap a node to follow its path'
                    )}
                </span>
            </div>

            <div className="relative mt-3 overflow-x-auto" ref={boxRef}>
                {narrow ? (
                    <ul data-testid="untangle-graph-outline">
                        <OutlineNode node={tree} depth={0} index={0} />
                    </ul>
                ) : (
                    <svg
                        viewBox={`0 0 ${width} ${svgHeight}`}
                        width={width}
                        height={svgHeight}
                        className="block max-w-none font-ui"
                        role="img"
                        aria-label={t(
                            'untangle.graph.alt',
                            'The plan as areas, goals, projects and tasks'
                        )}
                        onMouseLeave={() => setFocusId(null)}
                    >
                        <defs>
                            <filter
                                id="ug-glow"
                                x="-100%"
                                y="-100%"
                                width="300%"
                                height="300%"
                            >
                                <feGaussianBlur stdDeviation="3" result="b" />
                                <feMerge>
                                    <feMergeNode in="b" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <g transform={`translate(${LEFT},20)`}>
                            {placed.map((p) => {
                                if (!p.parent) return null;
                                const on = linkLit(p.parent, p);
                                const mx = (p.parent.x + p.x) / 2;
                                return (
                                    <path
                                        key={`l-${p.node.id}`}
                                        className={`ug-link ${on ? '' : 'ug-dim'}`}
                                        style={{
                                            animationDelay: `${(order.get(p.node.id) || 0) * 12}ms`,
                                        }}
                                        d={`M${p.parent.x},${p.parent.y} C${mx},${p.parent.y} ${mx},${p.y} ${p.x},${p.y}`}
                                        fill="none"
                                        strokeWidth={on && lit ? 2 : 1.2}
                                        stroke={
                                            on && lit
                                                ? COLOR[p.node.type]
                                                : 'rgba(255,255,255,0.6)'
                                        }
                                    />
                                );
                            })}
                            {placed.map((p) => {
                                const r = RADIUS[p.node.type];
                                const isLeaf = p.node.children.length === 0;
                                const labelX = isLeaf ? r + 8 : -(r + 8);
                                const lines = p.lines;
                                const firstY = isLeaf
                                    ? -((lines.length - 1) * 13) / 2 +
                                      4 -
                                      (p.node.sub ? 5 : 0)
                                    : -9 - (lines.length - 1) * 13;
                                const color = COLOR[p.node.type];
                                const on = isLit(p.node.id);
                                const glow =
                                    p.node.type === 'area' || (on && !!lit);
                                return (
                                    <g
                                        key={p.node.id}
                                        transform={`translate(${p.x},${p.y})`}
                                        onMouseEnter={() =>
                                            setFocusId(p.node.id)
                                        }
                                        onClick={() =>
                                            setPinnedId((cur) =>
                                                cur === p.node.id
                                                    ? null
                                                    : p.node.id
                                            )
                                        }
                                        data-testid={`untangle-graph-node-${p.node.type}`}
                                    >
                                        <g
                                            className={`ug-node ${on ? '' : 'ug-dim'}`}
                                            style={{
                                                animationDelay: `${(order.get(p.node.id) || 0) * 12 + 250}ms`,
                                            }}
                                        >
                                            {p.node.type === 'project' ? (
                                                <rect
                                                    x={-r}
                                                    y={-r}
                                                    width={r * 2}
                                                    height={r * 2}
                                                    rx="2.5"
                                                    fill={color}
                                                    filter={
                                                        glow
                                                            ? 'url(#ug-glow)'
                                                            : undefined
                                                    }
                                                />
                                            ) : (
                                                <circle
                                                    r={r}
                                                    fill={
                                                        p.node.type === 'goal'
                                                            ? '#5a7d9a'
                                                            : color
                                                    }
                                                    stroke={
                                                        p.node.type === 'goal'
                                                            ? color
                                                            : p.node.type ===
                                                                'root'
                                                              ? '#ffffff'
                                                              : 'none'
                                                    }
                                                    strokeWidth={1.6}
                                                    strokeDasharray={
                                                        p.node.type === 'goal'
                                                            ? '3 2'
                                                            : undefined
                                                    }
                                                    filter={
                                                        glow
                                                            ? 'url(#ug-glow)'
                                                            : undefined
                                                    }
                                                />
                                            )}
                                            <text
                                                x={labelX}
                                                y={firstY}
                                                textAnchor={
                                                    isLeaf ? 'start' : 'end'
                                                }
                                                className="text-[12px]"
                                                fill={
                                                    p.node.type === 'area'
                                                        ? '#ffffff'
                                                        : p.node.type ===
                                                                'root' ||
                                                            p.node.type ===
                                                                'someday'
                                                          ? '#e7e3da'
                                                          : '#ffffff'
                                                }
                                                fontWeight={
                                                    p.node.type === 'area'
                                                        ? 600
                                                        : p.node.type ===
                                                                'goal' ||
                                                            p.node.type ===
                                                                'project'
                                                          ? 500
                                                          : 400
                                                }
                                            >
                                                {lines.map((line, i) => (
                                                    <tspan
                                                        key={`${i}-${line}`}
                                                        x={labelX}
                                                        dy={i === 0 ? 0 : 13}
                                                    >
                                                        {line}
                                                    </tspan>
                                                ))}
                                            </text>
                                            {isLeaf && p.node.sub && (
                                                <text
                                                    x={labelX}
                                                    y={
                                                        firstY +
                                                        lines.length * 13 -
                                                        1
                                                    }
                                                    className="text-[10.5px]"
                                                    fill="#f3f1ec"
                                                >
                                                    {p.node.sub}
                                                </text>
                                            )}
                                        </g>
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                )}
            </div>
        </div>
    );
};

export default StructureGraph;
