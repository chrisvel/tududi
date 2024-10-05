import type * as crud from '../crud/types';
export declare const newFile404Error: (collection: crud.CrudCollection, id: string) => DOMException;
export declare const newFolder404Error: (collection: crud.CrudCollection) => DOMException;
export declare const newExistsError: () => DOMException;
export declare const newMissingError: () => DOMException;
