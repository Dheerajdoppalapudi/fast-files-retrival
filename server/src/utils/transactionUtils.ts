import { DataSource, QueryRunner } from 'typeorm';
import { AppDataSource } from '../config/db';

type TransactionCallback<T> = (queryRunner: QueryRunner) => Promise<T>;

export const executeTransaction = async <T>(callback: TransactionCallback<T>): Promise<T> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  
  try {
    const result = await callback(queryRunner);
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
};
