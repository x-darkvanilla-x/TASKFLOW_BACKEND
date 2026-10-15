import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  recipientUserId: string;

  @Prop({ required: true, trim: true })
  type: string; // 'workspace_added' | 'task_assigned' | 'workspace_removed' | 'general'

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ default: false })
  read: boolean;

  @Prop({ trim: true })
  link?: string;

  @Prop({ trim: true })
  actorId?: string;

  @Prop({ trim: true })
  actorName?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
