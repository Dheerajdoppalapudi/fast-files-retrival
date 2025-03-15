// types.ts
export interface Bucket {
    id: number;
    name: string;
    createdAt: string;
    parentId?: number | null;
    children?: Bucket[];
    permissions?: string[];
  }
  
  export interface TransformedBucket {
    key: number;
    name: string;
    modified: string;
    size: string;
    hasVersions: boolean;
  }