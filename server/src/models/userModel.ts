import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Unique, CreateDateColumn ,UpdateDateColumn} from 'typeorm';
import { Permission } from './Permission';
import { BaseEntity } from './BaseEntity';



@Entity()
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  username!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 50, default: 'user' })
  role!: string;

  @OneToMany(() => Permission, (permission) => permission.user)
  permissions!: Permission[];
}
