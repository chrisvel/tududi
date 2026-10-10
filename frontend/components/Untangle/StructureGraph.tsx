import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UntangleArea, UntangleKind } from '../../utils/untangleService';

// The plan drawn as the tree tududi stores: areas hold goals, goals hold
// projects, projects hold tasks, and the loose items hang off their area.
// A small tidy-tree layout, no library: leaves stack top to bottom, every
// parent sits level with the middle of its children.

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
}

const MAX_COLUMN = 180;
const MIN_COLUMN = 118;
const ROW = 26;
const LEFT = 64;
const RIGHT = 196;

const MARK: Record<NodeType, string> = {
    root: 'fill-paper-deep stroke-gray-300 dark:fill-gray-700 dark:stroke-gray-600',
    area: 'fill-brand dark:fill-brand-300',
    goal: 'fill-white stroke-amber-500 dark:fill-gray-800 dark:stroke-amber-400',
    project: 'fill-brand-600 dark:fill-brand-400',
    task: 'fill-gray-400 dark:fill-gray-500',
    waiting: 'fill-rose-500 dark:fill-rose-400',
    habit: 'fill-violet-500 dark:fill-violet-400',
    someday: 'fill-gray-300 dark:fill-gray-600',
};

// The same marks as HTML dots, for the outline shown on narrow screens
const DOT: Record<NodeType, string> = {
    root: 'bg-paper-deep ring-1 ring-gray-300 dark:bg-gray-700 dark:ring-gray-600',
    area: 'bg-brand dark:bg-brand-300',
    goal: 'bg-transparent ring-[1.5px] ring-amber-500 dark:ring-amber-400',
    project: 'rounded-[3px] bg-brand-600 dark:bg-brand-400',
    task: 'bg-gray-400 dark:bg-gray-500',
    waiting: 'bg-rose-500 dark:bg-rose-400',
    habit: 'bg-violet-500 dark:bg-violet-400',
    someday: 'bg-gray-300 dark:bg-gray-600',
};

const NARROW = 600;

const RADIUS: Record<NodeType, number> = {
    root: 6,
    area: 7,
    goal: 6,
    project: 5.5,
    task: 4.5,
    waiting: 4.5,
    habit: 4.5,
    someday: 4.5,
};

function cut(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
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
): {
    placed: Placed[];
    links: [Placed, Placed][];
    depth: number;
    leaves: number;
} {
    const placed: Placed[] = [];
    const links: [Placed, Placed][] = [];
    let leaf = 0;
    let maxDepth = 0;
    const place = (node: GraphNode, depth: number): Placed => {
        maxDepth = Math.max(maxDepth, depth);
        let y: number;
        const kids: Placed[] = [];
        if (node.children.length === 0) {
            y = leaf * ROW;
            leaf += 1;
        } else {
            for (const child of node.children)
                kids.push(place(child, depth + 1));
            y = (kids[0].y + kids[kids.length - 1].y) / 2;
        }
        const me = { node, x: depth * column, y, depth };
        placed.push(me);
        for (const kid of kids) links.push([me, kid]);
        return me;
    };
    place(root, 0);
    return { placed, links, depth: maxDepth, leaves: leaf };
}

const OutlineNode: React.FC<{ node: GraphNode; depth: number }> = ({
    node,
    depth,
}) => (
    <li>
        <div className="flex items-baseline gap-2 py-0.5">
            <span
                className={`relative top-[1px] inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[node.type]}`}
            />
            <span
                className={`min-w-0 text-sm ${
                    node.type === 'area'
                        ? 'font-semibold'
                        : node.type === 'goal' || node.type === 'project'
                          ? 'font-medium'
                          : node.type === 'someday' || node.type === 'root'
                            ? 'text-gray-500 dark:text-gray-400'
                            : ''
                }`}
            >
                {node.label}
                {node.sub && (
                    <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {node.sub}
                    </span>
                )}
            </span>
        </div>
        {node.children.length > 0 && (
            <ul
                className={`ml-[5px] border-l border-gray-200 pl-4 dark:border-gray-700 ${
                    depth === 0 ? 'mt-1 flex flex-col gap-2' : ''
                }`}
            >
                {node.children.map((child) => (
                    <OutlineNode
                        key={child.id}
                        node={child}
                        depth={depth + 1}
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
    // Columns stretch to the card on a wide screen and shrink to a floor on
    // a narrow one, past which the card scrolls sideways.
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
    const { placed, links, depth, leaves } = useMemo(
        () => layout(tree, column),
        [tree, column]
    );
    const width = LEFT + depth * column + RIGHT;
    const height = Math.max(1, leaves - 1) * ROW + 40;

    const legend: { type: NodeType; label: string }[] = [
        { type: 'area', label: t('untangle.graph.area', 'Area') },
        { type: 'goal', label: t('untangle.graph.goal', 'Goal') },
        { type: 'project', label: t('untangle.graph.project', 'Project') },
        { type: 'task', label: t('untangle.graph.task', 'Task') },
        { type: 'waiting', label: t('untangle.graph.waiting', 'Waiting for') },
        { type: 'habit', label: t('untangle.graph.habit', 'Habit') },
        { type: 'someday', label: t('untangle.graph.someday', 'Someday') },
    ];

    return (
        <div data-testid="untangle-graph">
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-gray-500 dark:text-gray-400">
                {legend.map((l) => (
                    <span
                        key={l.type}
                        className="inline-flex items-center gap-1.5"
                    >
                        <svg viewBox="0 0 12 12" className="h-3 w-3">
                            {l.type === 'project' ? (
                                <rect
                                    x="1.5"
                                    y="1.5"
                                    width="9"
                                    height="9"
                                    rx="2"
                                    className={MARK[l.type]}
                                />
                            ) : (
                                <circle
                                    cx="6"
                                    cy="6"
                                    r="4.5"
                                    strokeWidth="1.5"
                                    strokeDasharray={
                                        l.type === 'goal' ? '2 1.5' : undefined
                                    }
                                    className={MARK[l.type]}
                                />
                            )}
                        </svg>
                        {l.label}
                    </span>
                ))}
            </div>
            <div className="mt-3 overflow-x-auto" ref={boxRef}>
                {boxWidth > 0 && boxWidth < NARROW ? (
                    <ul data-testid="untangle-graph-outline">
                        <OutlineNode node={tree} depth={0} />
                    </ul>
                ) : (
                    <svg
                        viewBox={`0 0 ${width} ${height}`}
                        width={width}
                        height={height}
                        className="block max-w-none font-ui"
                        role="img"
                        aria-label={t(
                            'untangle.graph.alt',
                            'The plan as areas, goals, projects and tasks'
                        )}
                    >
                        <g transform={`translate(${LEFT},20)`}>
                            {links.map(([a, b]) => {
                                const mx = (a.x + b.x) / 2;
                                return (
                                    <path
                                        key={`${a.node.id}-${b.node.id}`}
                                        d={`M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`}
                                        fill="none"
                                        strokeWidth="1.4"
                                        className="stroke-gray-300 dark:stroke-gray-600"
                                    />
                                );
                            })}
                            {placed.map((p) => {
                                const r = RADIUS[p.node.type];
                                const isLeaf = p.node.children.length === 0;
                                const labelX = isLeaf ? r + 7 : -(r + 7);
                                return (
                                    <g
                                        key={p.node.id}
                                        transform={`translate(${p.x},${p.y})`}
                                    >
                                        {p.node.type === 'project' ? (
                                            <rect
                                                x={-r}
                                                y={-r}
                                                width={r * 2}
                                                height={r * 2}
                                                rx="2.5"
                                                className={MARK.project}
                                            />
                                        ) : (
                                            <circle
                                                r={r}
                                                strokeWidth={
                                                    p.node.type === 'goal' ||
                                                    p.node.type === 'root'
                                                        ? 1.6
                                                        : 0
                                                }
                                                strokeDasharray={
                                                    p.node.type === 'goal'
                                                        ? '3 2'
                                                        : undefined
                                                }
                                                className={MARK[p.node.type]}
                                            />
                                        )}
                                        <text
                                            x={labelX}
                                            y={
                                                isLeaf
                                                    ? p.node.sub
                                                        ? -1
                                                        : 4
                                                    : -9
                                            }
                                            textAnchor={
                                                isLeaf ? 'start' : 'end'
                                            }
                                            className={`text-[12px] ${
                                                p.node.type === 'area'
                                                    ? 'fill-ink font-semibold dark:fill-gray-100'
                                                    : p.node.type === 'root'
                                                      ? 'fill-gray-500 font-semibold dark:fill-gray-400'
                                                      : p.node.type ===
                                                          'someday'
                                                        ? 'fill-gray-500 dark:fill-gray-400'
                                                        : 'fill-ink dark:fill-gray-100'
                                            }`}
                                        >
                                            {cut(
                                                p.node.label,
                                                isLeaf
                                                    ? 30
                                                    : Math.floor(column / 7)
                                            )}
                                        </text>
                                        {isLeaf && p.node.sub && (
                                            <text
                                                x={labelX}
                                                y={11}
                                                className="fill-gray-500 text-[10.5px] dark:fill-gray-400"
                                            >
                                                {cut(p.node.sub, 24)}
                                            </text>
                                        )}
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
