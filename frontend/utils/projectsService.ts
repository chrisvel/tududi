import { Project } from '../entities/Project';
import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export const fetchProjects = async (
    stateFilter = 'all',
    areaFilter = ''
): Promise<Project[]> => {
    let url = 'projects';
    const params = new URLSearchParams();

    if (stateFilter !== 'all') params.append('state', stateFilter);
    if (areaFilter) params.append('area', areaFilter);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(getApiPath(url), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });

    await handleAuthResponse(response, 'Failed to fetch projects.');

    const data = await response.json();
    return data.projects || data;
};

export const fetchGroupedProjects = async (
    stateFilter = 'all',
    areaFilter = ''
): Promise<Record<string, Project[]>> => {
    let url = 'projects';
    const params = new URLSearchParams();

    params.append('grouped', 'true');
    if (stateFilter !== 'all') params.append('state', stateFilter);
    if (areaFilter) params.append('area', areaFilter);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(getApiPath(url), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });

    await handleAuthResponse(response, 'Failed to fetch projects.');

    const data = await response.json();
    return data;
};

export const fetchProjectById = async (projectId: string): Promise<Project> => {
    const response = await fetch(getApiPath(`project/${projectId}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });

    await handleAuthResponse(response, 'Failed to fetch project details.');
    return await response.json();
};

export const createProject = async (
    projectData: Partial<Project>
): Promise<Project> => {
    const response = await fetch(getApiPath('project'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(projectData),
    });

    await handleAuthResponse(response, 'Failed to create project.');
    return await response.json();
};

export const updateProject = async (
    projectUid: string,
    projectData: Partial<Project>
): Promise<Project> => {
    const response = await fetch(getApiPath(`project/${projectUid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(projectData),
    });

    await handleAuthResponse(response, 'Failed to update project.');
    return await response.json();
};

export const deleteProject = async (projectUid: string): Promise<void> => {
    if (!projectUid || projectUid === null || projectUid === undefined) {
        throw new Error('Cannot delete project: Invalid project UID');
    }

    console.log('Attempting to delete project with UID:', projectUid);

    const response = await fetch(getApiPath(`project/${projectUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    console.log('Delete response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete failed with response:', errorText);
        throw new Error(
            `Failed to delete project: ${response.status} - ${errorText}`
        );
    }

    await handleAuthResponse(response, 'Failed to delete project.');
};

export const fetchProjectBySlug = async (uidSlug: string): Promise<Project> => {
    const response = await fetch(getApiPath(`project/${uidSlug}`), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to fetch project.');
    return await response.json();
};
