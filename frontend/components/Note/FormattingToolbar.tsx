import React from 'react';
import ReactDOM from 'react-dom';

interface FormattingToolbarProps {
    visible: boolean;
    x: number;
    y: number;
    onBold: () => void;
    onItalic: () => void;
    onStrikethrough: () => void;
    onCode: () => void;
    onLink: () => void;
    onHeading: (level: number) => void;
}

interface ToolbarBtnProps {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
}

const ToolbarBtn: React.FC<ToolbarBtnProps> = ({ onClick, title, children, style }) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        style={style}
        className="px-1.5 py-0.5 rounded text-xs text-gray-200 hover:text-white hover:bg-gray-600 transition-colors min-w-[22px] text-center"
    >
        {children}
    </button>
);

const Divider: React.FC = () => (
    <div className="w-px h-4 bg-gray-600 mx-0.5 flex-shrink-0" />
);

const TOOLBAR_HEIGHT = 36;
const GAP = 6;

const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
    visible,
    x,
    y,
    onBold,
    onItalic,
    onStrikethrough,
    onCode,
    onLink,
    onHeading,
}) => {
    if (!visible) return null;

    return ReactDOM.createPortal(
        <div
            className="fixed z-[200] flex items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-xl bg-gray-800 border border-gray-700"
            style={{
                left: x,
                top: y - TOOLBAR_HEIGHT - GAP,
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
            }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <ToolbarBtn onClick={onBold} title="Bold" style={{ fontWeight: 700 }}>
                B
            </ToolbarBtn>
            <ToolbarBtn onClick={onItalic} title="Italic" style={{ fontStyle: 'italic' }}>
                I
            </ToolbarBtn>
            <ToolbarBtn onClick={onStrikethrough} title="Strikethrough" style={{ textDecoration: 'line-through' }}>
                S
            </ToolbarBtn>
            <ToolbarBtn onClick={onCode} title="Inline code" style={{ fontFamily: 'monospace' }}>
                `
            </ToolbarBtn>
            <Divider />
            <ToolbarBtn onClick={() => onHeading(1)} title="Heading 1">
                H1
            </ToolbarBtn>
            <ToolbarBtn onClick={() => onHeading(2)} title="Heading 2">
                H2
            </ToolbarBtn>
            <ToolbarBtn onClick={() => onHeading(3)} title="Heading 3">
                H3
            </ToolbarBtn>
            <Divider />
            <ToolbarBtn onClick={onLink} title="Link">
                🔗
            </ToolbarBtn>
        </div>,
        document.body
    );
};

export default FormattingToolbar;
