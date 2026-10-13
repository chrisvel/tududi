import React from 'react';

const BlogMessage: React.FC<{ title: string; body: string }> = ({
    title,
    body,
}) => (
    <div
        className="max-w-3xl rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-sm"
        data-testid="blog-message"
    >
        <h2 className="text-2xl font-semibold mb-2">{title}</h2>
        <p className="text-gray-600 dark:text-gray-300">{body}</p>
    </div>
);

export default BlogMessage;
