// src/repositories/UserRepository.ts
import { Repository } from 'typeorm';
import { AppDataSource } from '../config/db';
import { User } from '../models/userModel';
import bcrypt from 'bcrypt';

export type CreateUserDto = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUserDto = Partial<CreateUserDto>;
export type UserResponse = Omit<User, 'password'>;

export class UserRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async findAll(): Promise<User[]> {  
    return this.repository.find();
  }


  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }
  async findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  async create(data: CreateUserDto): Promise<User> {
    const user = this.repository.create(data);
    return this.repository.save(user);
  }

  async update(id: string, data: UpdateUserDto): Promise<User | null> {
    const user = await this.repository.findOneBy({ id });
    if (!user) {
      return null;
    }

    Object.assign(user, data);
    user.updated_at = new Date();
    return this.repository.save(user);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== null && result.affected !== undefined && result.affected > 0;
  }

  async createWithHashedPassword(data: {
    username: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<User> {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    return this.create({
      ...data,
      password: hashedPassword,
      role: data.role || 'user',
    });
  }

  toResponse(user: User): UserResponse {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }
}