import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WorkspaceDocument = Workspace & Document;

@Schema({ timestamps: true })
export class Workspace {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  slug?: string;

  @Prop({ trim: true, default: 'building' })
  icon?: string;

  @Prop({ trim: true, default: '#4F46E5' })
  color?: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ trim: true })
  ownerName?: string;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
