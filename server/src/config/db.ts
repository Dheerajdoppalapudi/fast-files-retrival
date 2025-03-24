// src/config/db.ts
import { DataSource } from 'typeorm';
import {Bucket} from '../models/Bucket'
import {User} from '../models/userModel'
import {MyItem} from '../models/Myitem'
import {ObjectVersion} from '../models/ObjectVersion'

import 'reflect-metadata';
import { Permission } from '../models/Permission';
import { Approval } from '../models/Approval';
import { Approver } from '../models/Approver';


// const AppDataSource = new DataSource({
//   type: 'mysql',
//   host: process.env.MYSQL_HOST || 'localhost',
//   port: parseInt(process.env.MYSQL_PORT || '3306'),
//   username: process.env.MYSQL_USERNAME || 'root',
//   password: process.env.MYSQL_PASSWORD || 'password',
//   database: process.env.MYSQL_DATABASE || 'mydatabase',
//   entities: [Bucket, MyItem, ObjectVersion, User, Permission, Approval, Approver],
//   synchronize: true, // Be careful with this in production
//   logging: false,
// });



// Initialize the DataSource
const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.SQLITE_DB_PATH || './database.db',
  entities: [Bucket, MyItem, ObjectVersion, User,Permission,Approval,Approver],
  synchronize: true,
  logging: false,
});

// Function to initialize the database
export async function initializeDB() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('Database connected and initialized');    
  }

  return AppDataSource;
}

// Export AppDataSource for use in repositories
export { AppDataSource };
export default initializeDB;