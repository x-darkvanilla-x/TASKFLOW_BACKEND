import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MemberDocument = Member & Document;

@Schema({ timestamps: true })
export class Member {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  email?: string;

  @Prop({ trim: true, default: 'Member' })
  role?: string;

  @Prop({ trim: true, default: 'bg-indigo-600' })
  avatarColor?: string;

  @Prop({ required: true, index: true })
  userId: string;
}

export const MemberSchema = SchemaFactory.createForClass(Member);
