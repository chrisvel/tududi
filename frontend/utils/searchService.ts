import { getApiPath } from '../config/paths';

interface SearchParams {
    query: string;
    filters?: string[];
    priority?: string;
    due?: string;
    defer?: string;
    tags?: string[];
    recurring?: string;
    limit?: number;
    offset?: number;
    excludeSubtasks?: boolean;
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

interface Pagination {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

interface SearchResponse {
    results: SearchResult[];
    pagination?: Pagination;
}

export const searchUniversal = async (
    params: SearchParams
): Promise<SearchResponse> => {
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

        if (params.defer) {
            queryParams.append('defer', params.defer);
        }

        if (params.tags && params.tags.length > 0) {
            queryParams.append('tags', params.tags.join(','));
        }

        if (params.recurring) {
            queryParams.append('recurring', params.recurring);
        }

        if (params.limit !== undefined) {
            queryParams.append('limit', params.limit.toString());
        }

        if (params.offset !== undefined) {
            queryParams.append('offset', params.offset.toString());
        }

        if (params.excludeSubtasks) {
            queryParams.append('excludeSubtasks', 'true');
        }

        const response = await fetch(
            getApiPath(`search?${queryParams.toString()}`),
            {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error('Search request failed');
        }

        const data = await response.json();
        return {
            results: data.results || [],
            pagination: data.pagination,
        };
    } catch (error) {
        console.error('Error searching:', error);
        throw error;
    }
};

// Export types for use in components
export type { SearchParams, SearchResult, Pagination, SearchResponse };
