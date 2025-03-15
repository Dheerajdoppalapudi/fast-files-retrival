// src/repositories/BaseRepository.ts
import { Database } from 'sqlite';

export interface Entity {
  id: string;
}

export abstract class BaseRepository<T extends Entity> {
  protected db: Database;
  protected tableName: string;

  constructor(db: Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  async findById(id: string): Promise<T | undefined> {
    return this.db.get<T>(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  async findAll(): Promise<T[]> {
    return this.db.all<T[]>(`SELECT * FROM ${this.tableName}`);
  }

  async find(conditions: Partial<T>): Promise<T[]> {
    const entries = Object.entries(conditions).filter(([_, value]) => value !== undefined);
    
    if (entries.length === 0) {
      return this.findAll();
    }

    const whereClause = entries.map(([key]) => `${key} = ?`).join(' AND ');
    const values = entries.map(([_, value]) => value);

    return this.db.all<T[]>(`SELECT * FROM ${this.tableName} WHERE ${whereClause}`, values);
  }

  async findOne(conditions: Partial<T>): Promise<T | undefined> {
    const entries = Object.entries(conditions).filter(([_, value]) => value !== undefined);
    
    if (entries.length === 0) {
      return undefined;
    }

    const whereClause = entries.map(([key]) => `${key} = ?`).join(' AND ');
    const values = entries.map(([_, value]) => value);

    return this.db.get<T>(`SELECT * FROM ${this.tableName} WHERE ${whereClause}`, values);
  }

  abstract create(entity: Omit<T, 'id'>): Promise<T>;
  abstract update(id: string, entity: Partial<T>): Promise<T | undefined>;
  abstract delete(id: string): Promise<boolean>;
}