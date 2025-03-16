import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ObjectVersion } from './ObjectVersion';
import { User } from './userModel';
import { Approver } from './Approver';
import {Bucket} from './Bucket'
import {MyItem} from './Myitem'
import { BaseEntity } from './BaseEntity';


@Entity({ name: 'approvals' })
export class Approval extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  objectVersionId?: string;

  @ManyToOne(() => ObjectVersion, (objectVersion) => objectVersion.approvals, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'objectVersionId' })
  objectVersion?: ObjectVersion;

  @Column({ type: 'uuid', nullable: true })
  bucketId?: string;

  @ManyToOne(() => Bucket, (bucket) => bucket.approvals, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'bucketId' })
  bucket?: Bucket;

  @Column({ type: 'uuid', nullable: true })
  itemId?: string;

  @ManyToOne(() => MyItem, (item) => item.approvals, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'itemId' })
  item?: MyItem;

  @Column({ type: 'uuid' })
  approverId!: string;

  @ManyToOne(() => Approver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approverId' })
  approver!: Approver;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 50 })
  decision!: string;

  @Column({ type: 'text', nullable: true })
  comments?: string;
}