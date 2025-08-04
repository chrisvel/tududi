import { Tag } from './Tag';

export interface Note {
    id?: number;
    nanoid?: string;
    title: string;
    content: string;
    created_at?: string;
    updated_at?: string;
    project_id?: number; // Foreign key for project
    tags?: Tag[];
    Tags?: Tag[]; // Sequelize association naming (capitalized)
    project?: {
        id: number;
        nanoid?: string;
        name: string;
    };
    Project?: {
        id: number;
        nanoid?: string;
        name: string;
    }; // Sequelize association naming (capitalized)
}
