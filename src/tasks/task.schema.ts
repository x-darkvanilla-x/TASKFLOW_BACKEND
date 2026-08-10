import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TaskDocument = Task & Document;

export enum TaskStatus {
  TODO = 'todo',
  DOING = 'doing',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  DONE = 'done',
  ON_HOLD = 'on-hold',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

  @Prop({
    required: true,
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Prop({
    required: true,
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Prop({ trim: true })
  dueDate?: string;

  @Prop({ trim: true })
  assignee?: string;

  @Prop({ trim: true })
  avatarColor?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({
    type: [
      {
        id: String,
        title: String,
        priority: String,
        assignee: String,
        dueDate: String,
      },
    ],
    default: [],
  })
  subtasks?: {
    id: string;
    title: string;
    priority: string;
    assignee: string;
    dueDate?: string;
  }[];

  @Prop({
    type: [
      {
        id: String,
        title: String,
        url: String,
      },
    ],
    default: [],
  })
  resources?: {
    id: string;
    title: string;
    url: string;
  }[];

  @Prop({ required: true, index: true })
  userId: string;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
