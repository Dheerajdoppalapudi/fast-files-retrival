import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Bucket } from './Bucket';
import { MyItem } from './Myitem';
import { User } from './userModel';
import { BaseEntity } from './BaseEntity';


@Entity({ name: 'permissions' })
export class Permission extends BaseEntity {
  @Column({ type: 'uuid', nullable: true }) 
  bucketId?: string;

  @Column({ type: 'uuid', nullable: true }) 
  itemId?: string;

  @Column({ type: 'uuid' }) 
  userId!: string;

  @Column({ type: 'varchar', length: 50 }) 
  permissionType!: string;

  @Column({ type: 'boolean', default: false }) 
  inherited!: boolean;

  @ManyToOne(() => Bucket, (bucket) => bucket.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bucketId' })
  bucket?: Bucket;

  @ManyToOne(() => MyItem, (item) => item.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item?: MyItem;

  @ManyToOne(() => User, (user) => user.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}