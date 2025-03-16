import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { MyItem } from './Myitem';
import { Permission } from './Permission';
import { Approval } from './Approval';
import {Approver} from "./Approver"
import { BaseEntity } from './BaseEntity';


@Entity({ name: 'buckets' })
export class Bucket extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'uuid', nullable: true }) 
  parentId?: string;

  @Column({ type: 'uuid' }) 
  userId!: string;

  @Column({ type: 'boolean', default: true }) 
  requiresApproval!: boolean;

  @Column({ type: 'boolean', default: true }) 
  ownerAutoApproves!: boolean;

  @Column({ type: 'uuid', nullable: true }) 
  defaultApproverId?: string;

  @ManyToOne(() => Approver, { nullable: true })
  @JoinColumn({ name: 'defaultApproverId' })
  defaultApprover?: Approver;

  @Column({ type: 'varchar', default: 'pending' }) 
  approvalStatus!: string;

  @ManyToOne(() => Bucket, (bucket) => bucket.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent?: Bucket;

  @OneToMany(() => Bucket, (bucket) => bucket.parent)
  children!: Bucket[];

  @OneToMany(() => MyItem, (object) => object.bucket)
  objects!: MyItem[];

  @OneToMany(() => Permission, (permission) => permission.bucket)
  permissions!: Permission[];

  @OneToMany(() => Approval, (approval) => approval.bucket)
  approvals!: Approval[];
}