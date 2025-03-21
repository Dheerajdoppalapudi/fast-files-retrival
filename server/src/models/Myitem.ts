import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Unique, CreateDateColumn } from 'typeorm';
import { Bucket } from './Bucket';
import { ObjectVersion } from './ObjectVersion';
import { Permission } from './Permission';
import { Approval } from './Approval';
import { Approver } from './Approver';
import { User } from './userModel';
import { BaseEntity } from './BaseEntity';


@Entity({ name: 'MyItems' })
@Unique(['bucket', 'key'])
export class MyItem extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  key!: string;

  @ManyToOne(() => Bucket, (bucket) => bucket.objects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bucketId' })
  bucket!: Bucket;

  @Column({ type: 'uuid' })
  bucketId!: string;

  @Column({ type: 'uuid' }) 
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  owner!: User;

  @Column({ type: 'boolean', default: true }) 
  versioningEnabled!: boolean;

  @Column({ type: 'boolean', default: false }) 
  requiresApproval!: boolean;

  @Column({ type: 'uuid', nullable: true }) 
  defaultApproverId?: string;

  @ManyToOne(() => Approver, { nullable: true })
  @JoinColumn({ name: 'defaultApproverId' })
  defaultApprover?: Approver;

  @Column({ type: 'boolean', default: true }) 
  ownerAutoApproves!: boolean;

  @Column({ type: 'varchar', default: 'pending' }) 
  approvalStatus!: string;

  @OneToMany(() => ObjectVersion, (version) => version.object, { cascade: true, onDelete: 'CASCADE' })
  versions!: ObjectVersion[];

  @OneToMany(() => Permission, (permission) => permission.item)
  permissions!: Permission[];

  @OneToMany(() => Approval, (approval) => approval.item)
  approvals!: Approval[];
}
