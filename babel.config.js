module.exports = {
    presets: [
        '@babel/preset-env',
        '@babel/preset-react',
        '@babel/preset-typescript',
    ],
    plugins: [
        // LTD-PATCH(T-103): React Refresh is for development, never Jest transforms.
        !['production', 'test'].includes(process.env.NODE_ENV) &&
            'react-refresh/babel',
    ].filter(Boolean),
};
