interface SearchParams {
    query: string;
    filters?: string[];
    priority?: string;
    due?: string;
    tags?: string[];
}

interface SearchResult {
    type: 'Task' | 'Project' | 'Area' | 'Note' | 'Tag';
    id: number;
    uid?: string;
    name: string;
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
}

export const searchUniversal = async (
    params: SearchParams
): Promise<SearchResult[]> => {
    try {
        const queryParams = new URLSearchParams();

        if (params.query) {
            queryParams.append('q', params.query);
        }

        if (params.filters && params.filters.length > 0) {
            queryParams.append('filters', params.filters.join(','));
        }

        if (params.priority) {
            queryParams.append('priority', params.priority);
        }

        if (params.due) {
            queryParams.append('due', params.due);
        }

        if (params.tags && params.tags.length > 0) {
            queryParams.append('tags', params.tags.join(','));
        }

        const response = await fetch(`/api/search?${queryParams.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Search request failed');
        }

        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Error searching:', error);
        throw error;
    }
};
