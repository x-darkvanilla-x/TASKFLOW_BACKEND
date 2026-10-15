import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';

export interface CreateNotificationDto {
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  actorId?: string;
  actorName?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification | null> {
    if (!dto.recipientUserId) return null;
    const notification = new this.notificationModel({
      recipientUserId: dto.recipientUserId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      read: false,
      link: dto.link,
      actorId: dto.actorId,
      actorName: dto.actorName,
      metadata: dto.metadata,
    });
    return notification.save();
  }

  async findAll(recipientUserId: string): Promise<any[]> {
    const list = await this.notificationModel
      .find({ recipientUserId })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    return list.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      link: n.link,
      timestamp: (n as any).createdAt?.toISOString() || new Date().toISOString(),
      metadata: n.metadata,
      actorId: n.actorId,
      actorName: n.actorName,
    }));
  }

  async markAsRead(id: string, recipientUserId: string): Promise<boolean> {
    const result = await this.notificationModel
      .updateOne({ _id: id, recipientUserId }, { $set: { read: true } })
      .exec();
    return result.modifiedCount > 0;
  }

  async markAllAsRead(recipientUserId: string): Promise<boolean> {
    const result = await this.notificationModel
      .updateMany({ recipientUserId }, { $set: { read: true } })
      .exec();
    return result.modifiedCount > 0;
  }

  async remove(id: string, recipientUserId: string): Promise<boolean> {
    const result = await this.notificationModel
      .deleteOne({ _id: id, recipientUserId })
      .exec();
    return result.deletedCount > 0;
  }

  async removeAll(recipientUserId: string): Promise<boolean> {
    const result = await this.notificationModel
      .deleteMany({ recipientUserId })
      .exec();
    return result.deletedCount > 0;
  }
}
